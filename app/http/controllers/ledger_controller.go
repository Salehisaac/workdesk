package controllers

import (
	"strings"

	"github.com/goravel/framework/contracts/http"

	"goravel/app/facades"
	"goravel/app/http/resources"
	"goravel/app/models"
	"goravel/app/services/ledgerinvite"
)

// LedgerController handles «دفتر مالی» — the money module's book.
//
// Read Store beside SessionController.Store: a ledger is created exactly the way
// a session is (a name, a picked member list, the creator as owner, then a deep
// link messaged to everyone else) and differs from a project in the same way both
// do — no supergroup is provisioned, so there is no ChatId here and no topics.
// The invite is what stands in for that group: with nothing appearing in anyone's
// chat list, a member who was never messaged has no way of learning the book
// exists. See the module's section in API_CONTRACT.md.
type LedgerController struct{}

func NewLedgerController() *LedgerController {
	return &LedgerController{}
}

// loadLedgerForMember loads a ledger by its {id} route param, with the two
// pools its transaction form reads, and verifies the given user may write in
// it — the ledger-level equivalent of loadSessionForMember. Returns a written
// response on any failure.
func loadLedgerForMember(ctx http.Context, userId string) (*models.Ledger, http.Response) {
	id, ok := parseRouteId(ctx.Request().Route("id"))
	if !ok {
		return nil, ctx.Response().Status(404).Json(http.Json{"error": "ledger not found"})
	}

	var ledger models.Ledger
	if err := facades.Orm().Query().
		With("Members").
		With("Tags").
		With("Sources").
		Where("id", id).
		First(&ledger); err != nil {
		return nil, ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}
	if ledger.ID == 0 {
		return nil, ctx.Response().Status(404).Json(http.Json{"error": "ledger not found"})
	}

	for _, member := range ledger.Members {
		if member.RefId == userId && member.RefSource == "users" {
			return &ledger, nil
		}
	}
	// The creator is always stored as a member, so reaching here really does
	// mean "not one of this book's people".
	return nil, ctx.Response().Status(403).Json(http.Json{"error": "not a member of this ledger"})
}

// loadLedgerForOwner is loadLedgerForMember with the stricter check the book
// itself needs: everyone in a ledger writes transactions in it — that is what a
// shared book is for — but renaming it or deleting it (and with it every line
// anyone ever recorded) belongs to whoever keeps it.
//
// Membership first, so a stranger gets the same 403 either way.
func loadLedgerForOwner(ctx http.Context, userId string) (*models.Ledger, http.Response) {
	ledger, errResp := loadLedgerForMember(ctx, userId)
	if errResp != nil {
		return nil, errResp
	}

	if ledger.OwnerRefId != userId {
		return nil, ctx.Response().Status(403).Json(http.Json{"error": "only the ledger's creator can do this"})
	}
	return ledger, nil
}

// ledgerIdsForMember is every ledger the given user may write in. Returned as
// []any so it can go straight into WhereIn.
func ledgerIdsForMember(userId string) ([]any, error) {
	var memberships []models.LedgerMember
	if err := facades.Orm().Query().
		Where("ref_id", userId).
		Where("ref_source", "users").
		Find(&memberships); err != nil {
		return nil, err
	}

	ids := make([]any, 0, len(memberships))
	seen := make(map[uint]bool, len(memberships))
	for i := range memberships {
		if seen[memberships[i].LedgerId] {
			continue
		}
		seen[memberships[i].LedgerId] = true
		ids = append(ids, memberships[i].LedgerId)
	}
	return ids, nil
}

// ledgerTransactions reads a book's lines, newest first.
//
// `id` breaks the tie after occurred_at for the same reason the job board
// orders by it: several transactions a day share a timestamp to the minute, and
// SQL guarantees nothing about the order of ties — without it the list would
// reshuffle itself between two loads of identical data.
func ledgerTransactions(ledgerIds []any) ([]models.LedgerTransaction, error) {
	if len(ledgerIds) == 0 {
		return nil, nil
	}

	var transactions []models.LedgerTransaction
	if err := facades.Orm().Query().
		With("Tags").
		WhereIn("ledger_id", ledgerIds).
		OrderByDesc("occurred_at").
		OrderByDesc("id").
		Find(&transactions); err != nil {
		return nil, err
	}
	return transactions, nil
}

// Index — GET /api/v1/ledgers.
//
// Every book the caller may write in, newest first, each already carrying its
// totals: the list screen shows a balance per row, and a book you have to open
// to find out whether it is in the black would be a list of names.
//
// The totals are folded in Go from one query over every relevant transaction
// rather than a GROUP BY per ledger — the same "load the rows, fold them here"
// shape the project report uses, and one round trip either way.
func (r *LedgerController) Index(ctx http.Context) http.Response {
	authUser, errResp := currentUser(ctx)
	if errResp != nil {
		return errResp
	}

	ledgerIds, err := ledgerIdsForMember(authUser.ID)
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}
	if len(ledgerIds) == 0 {
		return ctx.Response().Success().Json(resources.Ledgers(nil, nil))
	}

	var ledgers []models.Ledger
	if err := facades.Orm().Query().
		With("Members").
		WhereIn("id", ledgerIds).
		OrderByDesc("created_at").
		Find(&ledgers); err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}

	transactions, err := ledgerTransactions(ledgerIds)
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}

	byLedger := make(map[uint][]models.LedgerTransaction, len(ledgers))
	for i := range transactions {
		byLedger[transactions[i].LedgerId] = append(byLedger[transactions[i].LedgerId], transactions[i])
	}
	totals := make(map[uint]resources.LedgerTotals, len(ledgers))
	for i := range ledgers {
		totals[ledgers[i].ID] = resources.LedgerTotalsFor(byLedger[ledgers[i].ID])
	}

	return ctx.Response().Success().Json(resources.Ledgers(ledgers, totals))
}

// Show — GET /api/v1/ledgers/{id}. The book, its people, its two pools and
// every line in it, in one response.
//
// Every screen in the module is a cut of these same rows — the three tabs, and
// each of the five report periods — so they travel together once instead of a
// request per cut.
func (r *LedgerController) Show(ctx http.Context) http.Response {
	authUser, errResp := currentUser(ctx)
	if errResp != nil {
		return errResp
	}

	ledger, errResp := loadLedgerForMember(ctx, authUser.ID)
	if errResp != nil {
		return errResp
	}

	transactions, err := ledgerTransactions([]any{ledger.ID})
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}

	return ctx.Response().Success().Json(
		resources.LedgerDetail(ledger, resources.LedgerTotalsFor(transactions), transactions),
	)
}

type storeLedgerRequest struct {
	Name    string                   `json:"name"`
	Members []storePickedItemRequest `json:"members"`
}

// Store — POST /api/v1/ledgers.
//
// Creates the book, records who may write in it, then messages each of them a
// link that opens the mini app on this ledger. No group is provisioned, which is
// the difference from a project; the invite is the same one a session sends, for
// the same reason — nothing else would ever tell these people the book is there.
//
// Sending is best-effort by design: a member who has never started the bot has
// no chat to receive it, and refusing to create the book over that would make
// the module unusable for exactly the people it most needs to reach. Who was
// actually notified comes back in the response (members[].notifiedAt), so the
// screen can say so.
func (r *LedgerController) Store(ctx http.Context) http.Response {
	authUser, errResp := currentUser(ctx)
	if errResp != nil {
		return errResp
	}

	var request storeLedgerRequest
	if err := ctx.Request().Bind(&request); err != nil {
		return ctx.Response().Status(400).Json(http.Json{"error": "invalid request body"})
	}

	name := strings.TrimSpace(request.Name)
	if name == "" {
		return ctx.Response().Status(422).Json(http.Json{"error": "name is required"})
	}

	ledger := models.Ledger{OwnerRefId: authUser.ID, Name: name}
	if err := facades.Orm().Query().Create(&ledger); err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}

	displayName := strings.TrimSpace(authUser.FirstName + " " + authUser.LastName)
	members := []models.LedgerMember{
		{LedgerId: ledger.ID, RefId: authUser.ID, RefSource: "users", DisplayName: displayName, Online: true, Role: models.LedgerMemberRoleOwner},
	}
	for _, member := range request.Members {
		// The creator is added as owner above; a picker that also returned them
		// must not produce a second row (and a second invite).
		if member.Id == authUser.ID && member.Source == "users" {
			continue
		}
		members = append(members, models.LedgerMember{
			LedgerId:    ledger.ID,
			RefId:       member.Id,
			RefSource:   member.Source,
			DisplayName: member.DisplayName,
			Username:    member.Username,
			Phone:       member.Phone,
			Online:      member.Online,
			Role:        models.LedgerMemberRoleMember,
		})
	}

	// Sent before the insert so each row is written once, already carrying
	// whether its invite arrived — rather than inserted, messaged, and updated.
	ledgerinvite.Send(&ledger, members)

	if err := facades.Orm().Query().Create(&members); err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}
	ledger.Members = members

	// A brand new book has no lines, no tags and no sources by construction —
	// all three are written from the screen this response redirects to.
	return ctx.Response().Status(201).Json(
		resources.LedgerDetail(&ledger, resources.LedgerTotalsFor(nil), nil),
	)
}

// StoreTag — POST /api/v1/ledgers/{id}/tags.
//
// Tags are ledger-scoped, exactly like a project's: one written while recording
// a transaction is immediately available to every other line in the same book.
// Re-posting an existing name returns it with 200 rather than failing, for the
// same reason ProjectTagController.Store does — from the sheet's point of view
// "make this tag" and "give me this tag" are one intent.
func (r *LedgerController) StoreTag(ctx http.Context) http.Response {
	authUser, errResp := currentUser(ctx)
	if errResp != nil {
		return errResp
	}

	ledger, errResp := loadLedgerForMember(ctx, authUser.ID)
	if errResp != nil {
		return errResp
	}

	var request storeTagRequest
	if err := ctx.Request().Bind(&request); err != nil {
		return ctx.Response().Status(400).Json(http.Json{"error": "invalid request body"})
	}
	name := strings.TrimSpace(request.Name)
	if name == "" {
		return ctx.Response().Status(422).Json(http.Json{"error": "name is required"})
	}

	var existing models.LedgerTag
	if err := facades.Orm().Query().Where("ledger_id", ledger.ID).Where("name", name).First(&existing); err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}
	if existing.ID != 0 {
		return ctx.Response().Success().Json(resources.LedgerTag(&existing))
	}

	tag := models.LedgerTag{LedgerId: ledger.ID, Name: name}
	if color := strings.TrimSpace(request.Color); color != "" {
		tag.Color = &color
	}
	if err := facades.Orm().Query().Create(&tag); err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}

	return ctx.Response().Status(201).Json(resources.LedgerTag(&tag))
}

type storeSourceRequest struct {
	Name string `json:"name"`
}

// StoreSource — POST /api/v1/ledgers/{id}/sources.
//
// «منبع مالی» is a pool and not a fixed enum because a source is a thing this
// particular business owns — a cash box, one card, one account — and only its
// own bookkeeper can name it. Same create-or-return behaviour as tags.
func (r *LedgerController) StoreSource(ctx http.Context) http.Response {
	authUser, errResp := currentUser(ctx)
	if errResp != nil {
		return errResp
	}

	ledger, errResp := loadLedgerForMember(ctx, authUser.ID)
	if errResp != nil {
		return errResp
	}

	var request storeSourceRequest
	if err := ctx.Request().Bind(&request); err != nil {
		return ctx.Response().Status(400).Json(http.Json{"error": "invalid request body"})
	}
	name := strings.TrimSpace(request.Name)
	if name == "" {
		return ctx.Response().Status(422).Json(http.Json{"error": "name is required"})
	}

	var existing models.LedgerSource
	if err := facades.Orm().Query().Where("ledger_id", ledger.ID).Where("name", name).First(&existing); err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}
	if existing.ID != 0 {
		return ctx.Response().Success().Json(resources.LedgerSource(&existing))
	}

	source := models.LedgerSource{LedgerId: ledger.ID, Name: name}
	if err := facades.Orm().Query().Create(&source); err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}

	return ctx.Response().Status(201).Json(resources.LedgerSource(&source))
}

type updateLedgerRequest struct {
	Name *string `json:"name"`
}

// Update — PATCH /api/v1/ledgers/{id}. The book's creator alone
// (loadLedgerForOwner).
//
// A ledger's name is all there is to edit: its members are fixed at creation
// (like a session's, and for the same reason — they were messaged an invite),
// its tags and sources are pools with their own endpoints, and its balance is
// derived from the lines. PATCH-shaped anyway, so the one field can grow to two
// without the caller's meaning changing.
func (r *LedgerController) Update(ctx http.Context) http.Response {
	authUser, errResp := currentUser(ctx)
	if errResp != nil {
		return errResp
	}

	ledger, errResp := loadLedgerForOwner(ctx, authUser.ID)
	if errResp != nil {
		return errResp
	}

	var request updateLedgerRequest
	if err := ctx.Request().Bind(&request); err != nil {
		return ctx.Response().Status(400).Json(http.Json{"error": "invalid request body"})
	}

	if request.Name != nil {
		name := strings.TrimSpace(*request.Name)
		if name == "" {
			return ctx.Response().Status(422).Json(http.Json{"error": "name is required"})
		}
		ledger.Name = name
	}

	if err := facades.Orm().Query().Save(ledger); err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}

	transactions, err := ledgerTransactions([]any{ledger.ID})
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}

	return ctx.Response().Success().Json(
		resources.LedgerDetail(ledger, resources.LedgerTotalsFor(transactions), transactions),
	)
}

// Destroy — DELETE /api/v1/ledgers/{id}. The book's creator alone, and final:
// every line anyone recorded in it goes too.
//
// One delete, no manual cleanup — ledger_members, ledger_tags, ledger_sources
// and ledger_transactions are all ON DELETE CASCADE on the book, and the
// transaction↔tag pivot cascades from the transactions (see
// 20260813000008/9). Nothing outside the book points into it.
func (r *LedgerController) Destroy(ctx http.Context) http.Response {
	authUser, errResp := currentUser(ctx)
	if errResp != nil {
		return errResp
	}

	ledger, errResp := loadLedgerForOwner(ctx, authUser.ID)
	if errResp != nil {
		return errResp
	}

	if _, err := facades.Orm().Query().Delete(ledger); err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}

	return ctx.Response().NoContent(204)
}

type storeLedgerMembersRequest struct {
	Members []storePickedItemRequest `json:"members"`
}

// StoreMembers — POST /api/v1/ledgers/{id}/members. The book's creator alone.
//
// Same act as a session's: no group exists to add anyone to, so the rows and the
// invite message are the whole of it — a member who is never messaged has no way
// of learning the book is there. Sent before the insert so each row is written
// once already carrying whether its invite arrived (see Store).
func (r *LedgerController) StoreMembers(ctx http.Context) http.Response {
	authUser, errResp := currentUser(ctx)
	if errResp != nil {
		return errResp
	}

	ledger, errResp := loadLedgerForOwner(ctx, authUser.ID)
	if errResp != nil {
		return errResp
	}

	var request storeLedgerMembersRequest
	if err := ctx.Request().Bind(&request); err != nil {
		return ctx.Response().Status(400).Json(http.Json{"error": "invalid request body"})
	}
	if len(request.Members) == 0 {
		return ctx.Response().Status(422).Json(http.Json{"error": "members is required"})
	}

	existing := make(map[string]bool, len(ledger.Members))
	for i := range ledger.Members {
		existing[ledger.Members[i].RefId] = true
	}

	added := make([]models.LedgerMember, 0, len(request.Members))
	for _, member := range request.Members {
		if existing[member.Id] {
			continue
		}
		existing[member.Id] = true
		added = append(added, models.LedgerMember{
			LedgerId:    ledger.ID,
			RefId:       member.Id,
			RefSource:   member.Source,
			DisplayName: member.DisplayName,
			Username:    member.Username,
			Phone:       member.Phone,
			Online:      member.Online,
			Role:        models.LedgerMemberRoleMember,
		})
	}

	if len(added) > 0 {
		ledgerinvite.Send(ledger, added)

		if err := facades.Orm().Query().Create(&added); err != nil {
			return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
		}
		ledger.Members = append(ledger.Members, added...)
	}

	transactions, err := ledgerTransactions([]any{ledger.ID})
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}

	return ctx.Response().Status(201).Json(
		resources.LedgerDetail(ledger, resources.LedgerTotalsFor(transactions), transactions),
	)
}
