package resources

import (
	"github.com/goravel/framework/contracts/http"

	"goravel/app/models"
)

// LedgerTotals is the arithmetic the «مجموع» tab shows, computed once here so
// the list and the detail can never disagree about a book's balance.
//
// Money is summed as int64 rather than uint64 even though no single amount can
// be negative: `balance` is income minus expense and is negative in every book
// that has spent more than it took in, which is most of them, most months.
type LedgerTotals struct {
	Income  int64
	Expense int64
	Count   int
}

// LedgerTotalsFor folds a ledger's transactions into its totals. Takes the rows
// the caller already loaded rather than querying, so GET /ledgers can total
// every book from one query instead of one per book.
func LedgerTotalsFor(transactions []models.LedgerTransaction) LedgerTotals {
	totals := LedgerTotals{Count: len(transactions)}
	for i := range transactions {
		amount := int64(transactions[i].Amount)
		if transactions[i].Type == models.LedgerTypeExpense {
			totals.Expense += amount
			continue
		}
		totals.Income += amount
	}
	return totals
}

// Ledger matches the `Ledger` shape in the frontend's modules/ledger/types.ts.
//
// The three money figures are carried on the summary rather than derived
// client-side because the list screen shows them without ever loading a single
// transaction — a book's balance is the one thing you want to see before
// opening it.
func Ledger(l *models.Ledger, totals LedgerTotals) http.Json {
	var createdAt string
	if l.CreatedAt != nil {
		createdAt = l.CreatedAt.ToRfc3339String()
	}

	return http.Json{
		"id":               formatId(l.ID),
		"name":             l.Name,
		"memberCount":      len(l.Members),
		"totalIncome":      totals.Income,
		"totalExpense":     totals.Expense,
		"balance":          totals.Income - totals.Expense,
		"transactionCount": totals.Count,
		"createdAt":        createdAt,
	}
}

func Ledgers(ledgers []models.Ledger, totals map[uint]LedgerTotals) []http.Json {
	result := make([]http.Json, len(ledgers))
	for i := range ledgers {
		result[i] = Ledger(&ledgers[i], totals[ledgers[i].ID])
	}
	return result
}

// LedgerMember is the same `PickedItem` + role + notifiedAt shape a session
// member has, and carries notifiedAt for the same reason: a ledger has no group
// to add anyone to, so the invite message is the only thing that told them the
// book exists, and whether it arrived is worth reporting.
func LedgerMember(m *models.LedgerMember) http.Json {
	var notifiedAt any
	if m.NotifiedAt != nil {
		notifiedAt = m.NotifiedAt.ToRfc3339String()
	}

	return http.Json{
		"id":          m.RefId,
		"source":      m.RefSource,
		"displayName": m.DisplayName,
		"username":    m.Username,
		"phone":       m.Phone,
		"online":      m.Online,
		"role":        m.Role,
		"notifiedAt":  notifiedAt,
	}
}

func LedgerMembers(members []models.LedgerMember) []http.Json {
	result := make([]http.Json, len(members))
	for i := range members {
		result[i] = LedgerMember(&members[i])
	}
	return result
}

func LedgerTag(t *models.LedgerTag) http.Json {
	return http.Json{
		"id":       formatId(t.ID),
		"ledgerId": formatId(t.LedgerId),
		"name":     t.Name,
		"color":    t.Color,
	}
}

func LedgerTags(tags []models.LedgerTag) []http.Json {
	result := make([]http.Json, len(tags))
	for i := range tags {
		result[i] = LedgerTag(&tags[i])
	}
	return result
}

func LedgerSource(s *models.LedgerSource) http.Json {
	return http.Json{
		"id":       formatId(s.ID),
		"ledgerId": formatId(s.LedgerId),
		"name":     s.Name,
	}
}

func LedgerSources(sources []models.LedgerSource) []http.Json {
	result := make([]http.Json, len(sources))
	for i := range sources {
		result[i] = LedgerSource(&sources[i])
	}
	return result
}

// LedgerSourceNames indexes a ledger's sources by id, for the denormalized
// sourceName every transaction carries.
func LedgerSourceNames(sources []models.LedgerSource) map[uint]string {
	names := make(map[uint]string, len(sources))
	for i := range sources {
		names[sources[i].ID] = sources[i].Name
	}
	return names
}

// LedgerTransaction matches the `LedgerTransaction` shape in
// modules/ledger/types.ts.
//
// `tagIds` rather than whole tag objects: a transaction is only ever read
// alongside the ledger that owns it, and that response already carries the tag
// pool — so repeating a tag's name and colour on every row it appears on would
// be the same data three times over. sourceName is the exception, denormalized
// like a session's projectName, because the transaction sheet names the source
// on a row the reader may have scrolled far away from its pool.
func LedgerTransaction(t *models.LedgerTransaction, sourceNames map[uint]string) http.Json {
	var occurredAt string
	if t.OccurredAt != nil {
		occurredAt = t.OccurredAt.ToRfc3339String()
	}

	var createdAt string
	if t.CreatedAt != nil {
		createdAt = t.CreatedAt.ToRfc3339String()
	}

	var sourceId, sourceName any
	if t.SourceId != nil {
		sourceId = formatId(*t.SourceId)
		if name, ok := sourceNames[*t.SourceId]; ok {
			sourceName = name
		}
	}

	tagIds := make([]string, 0, len(t.Tags))
	for i := range t.Tags {
		tagIds = append(tagIds, formatId(t.Tags[i].TagId))
	}

	return http.Json{
		"id":           formatId(t.ID),
		"ledgerId":     formatId(t.LedgerId),
		"type":         t.Type,
		"amount":       t.Amount,
		"accountGroup": t.AccountGroup,
		"description":  t.Description,
		"sourceId":     sourceId,
		"sourceName":   sourceName,
		"tagIds":       tagIds,
		"assigneeId":   t.AssigneeRefId,
		"assigneeName": t.AssigneeName,
		"occurredAt":   occurredAt,
		"createdAt":    createdAt,
	}
}

func LedgerTransactions(transactions []models.LedgerTransaction, sourceNames map[uint]string) []http.Json {
	result := make([]http.Json, len(transactions))
	for i := range transactions {
		result[i] = LedgerTransaction(&transactions[i], sourceNames)
	}
	return result
}

// LedgerDetail is the whole book in one response: the summary, who may write in
// it, the two pools its transactions draw from, and every line.
//
// Transactions come down whole rather than paged by period because every screen
// in the module is a *cut* of the same rows — the three tabs, and each of the
// five report periods — and re-fetching per cut would put a round trip behind
// tapping «هفته قبل». The same reason GET /jobs is flat.
func LedgerDetail(
	l *models.Ledger,
	totals LedgerTotals,
	transactions []models.LedgerTransaction,
) http.Json {
	json := Ledger(l, totals)
	json["members"] = LedgerMembers(l.Members)
	json["tags"] = LedgerTags(l.Tags)
	json["sources"] = LedgerSources(l.Sources)
	json["transactions"] = LedgerTransactions(transactions, LedgerSourceNames(l.Sources))
	return json
}
