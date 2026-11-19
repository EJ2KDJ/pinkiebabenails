'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    getBookingScheduleError,
    getAvailabilitySlots,
    getIntervalsForDate,
    isWithinBookingWindow,
    makeInterval,
    pruneExpiredAvailabilityDates,
    validateAvailabilitySettings,
} = require('./booking-availability');

const TODAY = '2026-11-19';

test('booking window includes today and day 60, but not past or day 61', () => {
    assert.equal(isWithinBookingWindow(TODAY, TODAY), true);
    assert.equal(isWithinBookingWindow('2027-01-18', TODAY), true);
    assert.equal(isWithinBookingWindow('2027-01-19', TODAY), false);
    assert.equal(isWithinBookingWindow('2026-11-18', TODAY), false);
});

test('custom slots replace default hours and retain minute-level start times', () => {
    const settings = {
        openHour: 10,
        closeHour: 18,
        daysOff: [],
        customSlotsByDate: {
            [TODAY]: [
                { startTime: '09:00', endTime: '10:00' },
                { startTime: '11:30', endTime: '12:30' },
                { startTime: '21:00', endTime: '22:00' },
            ],
        },
    };

    const slots = getIntervalsForDate(settings, TODAY);
    assert.deepEqual(slots.map((slot) => slot.startTime), ['09:00', '11:30', '21:00']);
    assert.equal(slots[1].startsAt.toISOString(), '2026-11-19T03:30:00.000Z');
});

test('late-night slots end on the following Manila date', () => {
    const slot = makeInterval(TODAY, '23:00', '02:00');
    assert.equal(slot.endsNextDay, true);
    assert.equal(slot.localEndTime, '02:00');
    assert.equal(slot.endsAt.toISOString(), '2026-11-19T18:00:00.000Z');
});

test('booking approval requires the original slot to remain scheduled and not be a day off', () => {
    const slot = makeInterval(TODAY, '10:00', '11:00');
    const booking = { startsAt: slot.startsAt, endsAt: slot.endsAt };
    const settings = {
        openHour: 10,
        closeHour: 12,
        daysOff: [],
        customSlotsByDate: {},
    };

    assert.equal(getBookingScheduleError(settings, booking), '');
    assert.equal(getBookingScheduleError({
        ...settings,
        closeHour: 10,
    }, booking), 'slot_unavailable');
    assert.equal(getBookingScheduleError({
        ...settings,
        customSlotsByDate: {
            [TODAY]: [{ startTime: '10:00', endTime: '10:30' }],
        },
    }, booking), 'slot_unavailable');
    assert.equal(getBookingScheduleError({
        ...settings,
        daysOff: [TODAY],
    }, booking), 'day_off');
});

test('expired availability dates are pruned without changing current or future dates', () => {
    const settings = {
        daysOff: ['2026-11-18', TODAY, '2026-11-20'],
        customSlotsByDate: {
            '2026-11-18': [],
            [TODAY]: [{ startTime: '10:00', endTime: '11:00' }],
            '2026-11-20': [{ startTime: '11:00', endTime: '12:00' }],
        },
    };

    assert.deepEqual(pruneExpiredAvailabilityDates(settings, TODAY), {
        daysOff: [TODAY, '2026-11-20'],
        customSlotsByDate: {
            [TODAY]: [{ startTime: '10:00', endTime: '11:00' }],
            '2026-11-20': [{ startTime: '11:00', endTime: '12:00' }],
        },
    });
    assert.deepEqual(settings.daysOff, ['2026-11-18', TODAY, '2026-11-20']);
});

test('empty custom slots close a date and accepted overlaps are unavailable', () => {
    const settings = {
        openHour: 10,
        closeHour: 12,
        daysOff: [],
        customSlotsByDate: {
            [TODAY]: [{ startTime: '11:30', endTime: '12:30' }],
        },
    };
    const slot = makeInterval(TODAY, '11:30', '12:30');
    const now = new Date('2026-11-18T00:00:00.000Z');
    const slots = getAvailabilitySlots(settings, TODAY, [{
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
    }], now);
    assert.equal(slots[0].available, false);
    settings.customSlotsByDate[TODAY] = [];
    assert.deepEqual(getIntervalsForDate(settings, TODAY), []);
});

test('overlapping slots across midnight and duplicate-start intervals are blocked', () => {
    const settings = {
        openHour: 10,
        closeHour: 18,
        daysOff: [],
        customSlotsByDate: {
            [TODAY]: [
                { startTime: '23:00', endTime: '02:00' },
                { startTime: '09:00', endTime: '12:00' },
                { startTime: '09:00', endTime: '10:00' },
            ],
            '2026-11-20': [{ startTime: '01:00', endTime: '02:00' }],
        },
    };
    const slots = getAvailabilitySlots(settings, TODAY, [], new Date('2026-11-18T00:00:00.000Z'));
    assert.equal(slots.find((slot) => slot.time === '23:00').available, false);
    assert.equal(slots.find((slot) => slot.time === '09:00').available, false);
    assert.equal(validateAvailabilitySettings(settings, TODAY), 'Appointment slots cannot overlap, including across midnight.');
});

test('settings validation rejects dates outside the window and overlapping slots', () => {
    const base = {
        openHour: 10,
        closeHour: 18,
        daysOff: [],
        customSlotsByDate: {},
    };
    assert.equal(validateAvailabilitySettings({
        ...base,
        customSlotsByDate: { '2026-11-18': [] },
    }, TODAY), 'Custom availability dates must be within the next 60 days.');
    assert.equal(validateAvailabilitySettings({
        ...base,
        customSlotsByDate: {
            [TODAY]: [
                { startTime: '21:00', endTime: '01:00' },
                { startTime: '23:00', endTime: '02:00' },
            ],
        },
    }, TODAY), 'Appointment slots cannot overlap, including across midnight.');
});
