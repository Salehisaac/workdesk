package controllers

import (
	"strconv"
	"strings"

	"github.com/goravel/framework/contracts/http"
	"github.com/goravel/framework/support/carbon"

	"goravel/app/facades"
	"goravel/app/http/resources"
	"goravel/app/models"
)

// LedgerTransactionController handles the lines of a «دفتر مالی» — «درآمد» and
// «هزینه», which are one resource with two directions rather than two.
//
// They are written ledger-scoped and read as part of GET /ledgers/{id}, never
// flat: a transaction outside its book is an amount with no balance to belong
// to. That is the opposite call from Decision, which reads flat because a
// commitment is owed whether or not its meeting is on screen.
type LedgerTransactionController struct{}

func NewLedgerTransactionController() *LedgerTransactionController {
	return &LedgerTransactionController{}
}

type storeTransactionRequest struct {
	Type string `json:"type"`
	// Toman, whole units, always positive — the direction is `type`'s job.
	// Signed on the wire only so a negative can be rejected with a sentence
	// instead of failing to bind.
	Amount       int64    `json:"amount"`
	AccountGroup string   `json:"accountGroup"`
	Description  string   `json:"description"`
	SourceId     string   `json:"sourceId"`
	TagIds       []string `json:"tagIds"`
	// The «مسئول», as the whole picked item — stored verbatim, the same opaque
	// reference project members are, rather than an id the server would have to
	// resolve against a directory it doesn't own.
	Assignee *storePickedItemRequest `json:"assignee"`
	// RFC 3339 carrying the device's offset. Blank means "now".
	OccurredAt string `json:"occurredAt"`
}

// resolveLedgerSource maps the wire's sourceId to one of this ledger's own
// sources. Blank means "no source", which is the common case.
func resolveLedgerSource(ctx http.Context, ledger *models.Ledger, raw string) (*uint, http.Response) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil, nil
	}

	// Parsed rather than compared as a string because it arrives in a request
	// body — same care resolveNoteProject takes.
	parsed, err := strconv.ParseUint(trimmed, 10, 64)
	if err != nil {
		return nil, ctx.Response().Status(422).Json(http.Json{"error": "sourceId must be a source id"})
	}

	for i := range ledger.Sources {
		if ledger.Sources[i].ID == uint(parsed) {
			id := ledger.Sources[i].ID
			return &id, nil
		}
	}
	// 422, not 404: the source is a field of the transaction being written, not
	// the resource being addressed.
	return nil, ctx.Response().Status(422).Json(http.Json{"error": "sourceId is not one of this ledger's sources"})
}

// resolveLedgerTags maps the wire's tagIds to this ledger's own tags, rejecting
// anything from another book. Without the check a member of one ledger could
// label their transaction with a tag belonging to somebody else's.
func resolveLedgerTags(ctx http.Context, ledger *models.Ledger, raw []string) ([]uint, http.Response) {
	if len(raw) == 0 {
		return nil, nil
	}

	owned := make(map[uint]bool, len(ledger.Tags))
	for i := range ledger.Tags {
		owned[ledger.Tags[i].ID] = true
	}

	ids := make([]uint, 0, len(raw))
	seen := make(map[uint]bool, len(raw))
	for _, value := range raw {
		parsed, err := strconv.ParseUint(strings.TrimSpace(value), 10, 64)
		if err != nil || !owned[uint(parsed)] {
			return nil, ctx.Response().Status(422).Json(http.Json{"error": "tag \"" + value + "\" is not one of this ledger's tags"})
		}
		if seen[uint(parsed)] {
			continue
		}
		seen[uint(parsed)] = true
		ids = append(ids, uint(parsed))
	}
	return ids, nil
}

// Store — POST /api/v1/ledgers/{id}/transactions.
func (r *LedgerTransactionController) Store(ctx http.Context) http.Response {
	authUser, errResp := currentUser(ctx)
	if errResp != nil {
		return errResp
	}

	ledger, errResp := loadLedgerForMember(ctx, authUser.ID)
	if errResp != nil {
		return errResp
	}

	var request storeTransactionRequest
	if err := ctx.Request().Bind(&request); err != nil {
		return ctx.Response().Status(400).Json(http.Json{"error": "invalid request body"})
	}

	transactionType := strings.TrimSpace(request.Type)
	if !containsString(models.LedgerTypes, transactionType) {
		return ctx.Response().Status(422).Json(http.Json{"error": "type must be one of " + strings.Join(models.LedgerTypes, ", ")})
	}

	// Zero is rejected along with negatives: a line worth nothing moves no
	// money, and letting one in would put a «۰ تومان» row in the middle of a
	// book where every other row means something.
	if request.Amount <= 0 {
		return ctx.Response().Status(422).Json(http.Json{"error": "amount must be greater than zero"})
	}

	accountGroup := strings.TrimSpace(request.AccountGroup)
	if accountGroup == "" {
		accountGroup = models.LedgerGroupOther
	}
	if !containsString(models.LedgerAccountGroups, accountGroup) {
		return ctx.Response().Status(422).Json(http.Json{"error": "accountGroup must be one of " + strings.Join(models.LedgerAccountGroups, ", ")})
	}

	// Absent means now — the form seeds the field with the current moment, so a
	// request without one is a client that didn't ask, not one that means "no
	// day". A transaction always happened somewhen.
	occurredAt := carbon.Now()
	if raw := strings.TrimSpace(request.OccurredAt); raw != "" {
		parsed := carbon.Parse(raw)
		if parsed == nil || parsed.Error != nil {
			return ctx.Response().Status(422).Json(http.Json{"error": "occurredAt must be an ISO 8601 timestamp"})
		}
		occurredAt = parsed
	}

	sourceId, errResp := resolveLedgerSource(ctx, ledger, request.SourceId)
	if errResp != nil {
		return errResp
	}

	tagIds, errResp := resolveLedgerTags(ctx, ledger, request.TagIds)
	if errResp != nil {
		return errResp
	}

	transaction := models.LedgerTransaction{
		LedgerId:     ledger.ID,
		OwnerRefId:   authUser.ID,
		Type:         transactionType,
		Amount:       uint64(request.Amount),
		AccountGroup: accountGroup,
		SourceId:     sourceId,
		OccurredAt:   carbon.NewDateTime(occurredAt),
	}
	if description := strings.TrimSpace(request.Description); description != "" {
		transaction.Description = &description
	}
	// Both halves of the assignee or neither: a ref with no name would render
	// as an empty «مسئول» chip, and a name with no ref could never be matched
	// back to a person.
	if request.Assignee != nil {
		refId := strings.TrimSpace(request.Assignee.Id)
		name := strings.TrimSpace(request.Assignee.DisplayName)
		if refId != "" && name != "" {
			transaction.AssigneeRefId = &refId
			transaction.AssigneeName = &name
		}
	}

	if err := facades.Orm().Query().Create(&transaction); err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}

	if len(tagIds) > 0 {
		links := make([]models.LedgerTransactionTag, 0, len(tagIds))
		for _, id := range tagIds {
			links = append(links, models.LedgerTransactionTag{TransactionId: transaction.ID, TagId: id})
		}
		if err := facades.Orm().Query().Create(&links); err != nil {
			return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
		}
		transaction.Tags = links
	}

	return ctx.Response().Status(201).Json(
		resources.LedgerTransaction(&transaction, resources.LedgerSourceNames(ledger.Sources)),
	)
}

// Destroy — DELETE /api/v1/ledgers/{id}/transactions/{transactionId}.
//
// The one thing in this module that can be undone, and the only editing it
// offers. A ledger is the one module where a wrong row is not merely untidy —
// it is a balance that says something false, and every screen here is derived
// from these rows. Correcting a mistyped amount is deleting the line and
// writing it again, which is also what a paper book's owner does.
//
// Any member may delete any line, matching the rest of the module: the ledger
// is the unit of authorization, exactly as the session is for a مصوبه.
func (r *LedgerTransactionController) Destroy(ctx http.Context) http.Response {
	authUser, errResp := currentUser(ctx)
	if errResp != nil {
		return errResp
	}

	ledger, errResp := loadLedgerForMember(ctx, authUser.ID)
	if errResp != nil {
		return errResp
	}

	transactionId, ok := parseRouteId(ctx.Request().Route("transactionId"))
	if !ok {
		return ctx.Response().Status(404).Json(http.Json{"error": "transaction not found"})
	}

	var transaction models.LedgerTransaction
	if err := facades.Orm().Query().Where("id", transactionId).First(&transaction); err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}
	// A line from another book reads as 404 rather than 403 — as far as this
	// caller is concerned it does not exist, the same call PATCH /jobs makes.
	if transaction.ID == 0 || transaction.LedgerId != ledger.ID {
		return ctx.Response().Status(404).Json(http.Json{"error": "transaction not found"})
	}

	// The pivot rows go first. The schema already cascades them (orm.Model has
	// no DeletedAt, so this really is a hard delete), but a tag link outliving
	// its transaction would be a row nothing could ever reach — worth not
	// leaving to a constraint a later migration might drop.
	if _, err := facades.Orm().Query().Where("transaction_id", transaction.ID).Delete(&models.LedgerTransactionTag{}); err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}
	if _, err := facades.Orm().Query().Delete(&transaction); err != nil {
		return ctx.Response().Status(500).Json(http.Json{"error": err.Error()})
	}

	return ctx.Response().NoContent(204)
}
