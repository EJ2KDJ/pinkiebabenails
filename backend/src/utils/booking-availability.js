'use strict';

const DAY_MS = 24 * 60 * 60 * 1000;
const MANILA_UTC_OFFSET_HOURS = 8;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function manilaDateKey(date) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
}

function addDateDays(dateKey, days) {
    return new Date(Date.parse(`${dateKey}T00:00:00.000Z`) + days * DAY_MS)
        .toISOString()
        .slice(0, 10);
}

function isValidDateOnly(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isWithinBookingWindow(dateKey, today = manilaDateKey(new Date())) {
    if (!isValidDateOnly(dateKey) || !isValidDateOnly(today)) return false;
    const daysAhead = (Date.parse(`${dateKey}T00:00:00.000Z`)
        - Date.parse(`${today}T00:00:00.000Z`)) / DAY_MS;
    return daysAhead >= 0 && daysAhead <= 60;
}

function timeMinutes(value) {
    if (typeof value !== 'string' || !TIME_PATTERN.test(value)) return null;
    const [hour, minute] = value.split(':').map(Number);
    return hour * 60 + minute;
}

function makeInterval(dateKey, startTime, endTime) {
    const startMinutes = timeMinutes(startTime);
    const endMinutes = timeMinutes(endTime);
    if (startMinutes === null || endMinutes === null || startMinutes === endMinutes) return null;

    const durationMinutes = (endMinutes - startMinutes + 1440) % 1440;
    const startDate = new Date(`${dateKey}T00:00:00.000Z`);
    const startsAt = new Date(Date.UTC(
        startDate.getUTCFullYear(),
        startDate.getUTCMonth(),
        startDate.getUTCDate(),
        Math.floor(startMinutes / 60) - MANILA_UTC_OFFSET_HOURS,
        startMinutes % 60
    ));
    const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
    const endDateKey = manilaDateKey(endsAt);
    const endParts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Manila',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(endsAt);
    const endValues = Object.fromEntries(endParts.map((part) => [part.type, part.value]));

    return {
        date: dateKey,
        startTime,
        endTime,
        startsAt,
        endsAt,
        endsNextDay: endDateKey !== dateKey,
        durationMinutes,
        localEndTime: `${endValues.hour}:${endValues.minute}`,
    };
}

function getIntervalsForDate(settings, dateKey) {
    if ((settings.daysOff || []).includes(dateKey)) return [];

    const customSlots = settings.customSlotsByDate || {};
    if (Object.prototype.hasOwnProperty.call(customSlots, dateKey)) {
        return customSlots[dateKey]
            .map((slot) => makeInterval(dateKey, slot.startTime, slot.endTime))
            .filter(Boolean);
    }

    const intervals = [];
    for (let hour = settings.openHour; hour < settings.closeHour; hour += 1) {
        const startTime = `${String(hour).padStart(2, '0')}:00`;
        const endHour = (hour + 1) % 24;
        const endTime = `${String(endHour).padStart(2, '0')}:00`;
        intervals.push(makeInterval(dateKey, startTime, endTime));
    }
    return intervals;
}

function validateAvailabilitySettings(settings, today = manilaDateKey(new Date())) {
    if (!Number.isInteger(settings.openHour) || settings.openHour < 0 || settings.openHour > 23
        || !Number.isInteger(settings.closeHour) || settings.closeHour < 1
        || settings.closeHour > 24 || settings.closeHour <= settings.openHour) {
        return 'Choose valid opening and closing times.';
    }

    if (!Array.isArray(settings.daysOff)
        || settings.daysOff.some((date) => !isWithinBookingWindow(date, today))
        || new Set(settings.daysOff).size !== settings.daysOff.length) {
        return 'Choose unique days off from today through 60 days from now.';
    }

    const customSlots = settings.customSlotsByDate;
    if (!customSlots || typeof customSlots !== 'object' || Array.isArray(customSlots)) {
        return 'Custom availability must be a list of dates and time slots.';
    }

    const dateKeys = Object.keys(customSlots);
    if (dateKeys.some((date) => !isWithinBookingWindow(date, today))) {
        return 'Custom availability dates must be within the next 60 days.';
    }
    if (dateKeys.some((date) => !Array.isArray(customSlots[date]) || customSlots[date].length > 40)) {
        return 'Each date can have up to 40 appointment slots.';
    }

    for (const date of dateKeys) {
        const seen = new Set();
        for (const slot of customSlots[date]) {
            if (!slot || timeMinutes(slot.startTime) === null || timeMinutes(slot.endTime) === null
                || slot.startTime === slot.endTime) {
                return 'Each time slot needs a valid start and end time.';
            }
            const key = `${slot.startTime}-${slot.endTime}`;
            if (seen.has(key)) return 'Duplicate appointment slots are not allowed.';
            seen.add(key);
        }
    }

    const intervals = [];
    for (let day = 0; day <= 60; day += 1) {
        const dateKey = addDateDays(today, day);
        intervals.push(...getIntervalsForDate(settings, dateKey));
    }
    intervals.sort((first, second) => first.startsAt - second.startsAt);
    for (let index = 1; index < intervals.length; index += 1) {
        if (intervals[index].startsAt < intervals[index - 1].endsAt) {
            return 'Appointment slots cannot overlap, including across midnight.';
        }
    }

    return '';
}

function getAvailabilitySlots(settings, dateKey, acceptedBookings = [], now = new Date()) {
    const candidates = getIntervalsForDate(settings, dateKey);
    const nearbyIntervals = [];
    for (const offset of [-1, 0, 1]) {
        nearbyIntervals.push(...getIntervalsForDate(settings, addDateDays(dateKey, offset)));
    }
    const accepted = acceptedBookings.map((booking) => ({
        startsAt: new Date(booking.startsAt).getTime(),
        endsAt: new Date(booking.endsAt).getTime(),
    }));

    return candidates.map((interval) => {
        const overlapsOtherSlot = nearbyIntervals.some((other) => (
            (other.startsAt.getTime() !== interval.startsAt.getTime()
                || other.endsAt.getTime() !== interval.endsAt.getTime())
            && other.startsAt < interval.endsAt
            && other.endsAt > interval.startsAt
        ));
        const overlapsBooking = accepted.some((booking) => (
            booking.startsAt < interval.endsAt.getTime()
            && booking.endsAt > interval.startsAt.getTime()
        ));
        return {
            time: interval.startTime,
            endTime: interval.localEndTime,
            endsNextDay: interval.endsNextDay,
            available: interval.startsAt > now && !overlapsOtherSlot && !overlapsBooking,
        };
    });
}

module.exports = {
    addDateDays,
    getAvailabilitySlots,
    getIntervalsForDate,
    isValidDateOnly,
    isWithinBookingWindow,
    makeInterval,
    manilaDateKey,
    timeMinutes,
    validateAvailabilitySettings,
};
