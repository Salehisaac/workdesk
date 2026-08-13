package controllers

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

// tehran is the zone WorkDesk's users write from — fixed at +03:30, since Iran
// abolished DST in 2022 (same reasoning as support/jalali).
var tehran = time.FixedZone("Asia/Tehran", 3*3600+30*60)

// The whole point of a note: it is filed under the day it was written on, so
// the client may only claim the day it is actually on.
func TestIsToday(t *testing.T) {
	now := time.Date(2026, 8, 13, 21, 40, 0, 0, tehran)

	tests := []struct {
		name    string
		claimed time.Time
		want    bool
	}{
		{"the same instant", now, true},
		{"earlier the same day", time.Date(2026, 8, 13, 0, 1, 0, 0, tehran), true},
		{"the last minute of the same day", time.Date(2026, 8, 13, 23, 59, 0, 0, tehran), true},
		{"yesterday", time.Date(2026, 8, 12, 21, 40, 0, 0, tehran), false},
		{"tomorrow", time.Date(2026, 8, 14, 0, 1, 0, 0, tehran), false},
		// A device somewhere else asking for *its* today. 21:40 in Tehran is
		// 19:10 in Berlin on the same date, so this is still that device's
		// current day and must be accepted.
		{"the same instant seen from another zone", now.In(time.FixedZone("CEST", 2*3600)), true},
		// …and past midnight there, it isn't: for a device on +12, the same
		// instant is already the 14th, so a note claiming the 13th is claiming
		// a day that device has left.
		{"a day the device has already left", time.Date(2026, 8, 13, 21, 40, 0, 0, time.FixedZone("NZST", 12*3600)), false},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			assert.Equal(t, test.want, isToday(test.claimed, now))
		})
	}
}
