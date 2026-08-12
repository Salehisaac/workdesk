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

// FormatDateTime renders «چهارشنبه ۲۱ مرداد ۱۴۰۵، ساعت ۱۴:۰۵».
//
// The instant is converted in its own location, so a time stored as UTC has to
// arrive already in the zone it should read in — callers pass t.Local().
func FormatDateTime(t time.Time) string {
	p := ptime.New(t)
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
