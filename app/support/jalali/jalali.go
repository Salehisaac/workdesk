// Package jalali formats times the way WorkDesk's users read them.
//
// The frontend has its own Jalali layer (shared/date/jalali.ts) because it
// renders calendars; the backend needs the same calendar only for the text it
// puts into chat messages, so this is deliberately just formatting — no
// arithmetic, no grid building. The conversion itself comes from
// go-persian-calendar rather than being hand-rolled.
package jalali

import (
	"fmt"
	"strings"
	"time"

	ptime "github.com/yaa110/go-persian-calendar"
)

var persianDigits = []rune{'۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'}

// ToPersianDigits rewrites 0-9 as ۰-۹. Mirrors toPersianDigits on the frontend.
func ToPersianDigits(value string) string {
	var b strings.Builder
	for _, r := range value {
		if r >= '0' && r <= '9' {
			b.WriteRune(persianDigits[r-'0'])
		} else {
			b.WriteRune(r)
		}
	}
	return b.String()
}

// iranOffset is Iran's UTC offset. Fixed, not seasonal — Iran abolished DST in
// 2022, so there's no period this is wrong for.
const iranOffset = 3*3600 + 30*60

// displayLocation is the zone user-facing text is rendered in.
//
// Deliberately not the app timezone: config/app.go sets that to UTC, and the
// framework hands it to carbon.SetTimezone, so anything formatted from a stored
// carbon value comes out as UTC wall time. That's correct for storage and for
// the dispatcher's `remind_at <= now()` comparison, and wrong for a sentence a
// person reads — it's what made a reminder set for ۲۱:۵۳ arrive saying ۱۸:۲۳.
//
// Falls back to a fixed +03:30 zone when the tz database isn't present, so this
// can't silently degrade back to UTC on a minimal image.
var displayLocation = func() *time.Location {
	if loc, err := time.LoadLocation("Asia/Tehran"); err == nil {
		return loc
	}
	return time.FixedZone("Asia/Tehran", iranOffset)
}()

// FormatDateTime renders «چهارشنبه ۲۱ مرداد ۱۴۰۵، ساعت ۱۴:۰۵».
//
// The instant is converted into displayLocation first, so callers can pass
// whatever they have — a UTC value out of the database or an offset-carrying
// one straight off a request — and get the same, correct wall clock either way.
func FormatDateTime(t time.Time) string {
	p := ptime.New(t.In(displayLocation))
	return ToPersianDigits(fmt.Sprintf(
		"%s %d %s %d، ساعت %02d:%02d",
		p.Weekday().String(),
		p.Day(),
		p.Month().String(),
		p.Year(),
		p.Hour(),
		p.Minute(),
	))
}
