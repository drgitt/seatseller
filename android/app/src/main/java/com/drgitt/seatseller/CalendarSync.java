package com.drgitt.seatseller;

import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.ContentValues;
import android.content.Context;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.net.Uri;
import android.provider.CalendarContract;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Iterator;
import java.util.Locale;
import java.util.TimeZone;

/** Adds one all-day event per game to the phone's calendar and keeps them updated. */
final class CalendarSync {
    private CalendarSync() {}

    static long utcMidnight(String ymd) {
        String[] p = ymd.split("-");
        Calendar c = Calendar.getInstance(TimeZone.getTimeZone("UTC"));
        c.clear();
        c.set(Integer.parseInt(p[0]), Integer.parseInt(p[1]) - 1, Integer.parseInt(p[2]), 0, 0, 0);
        return c.getTimeInMillis();
    }

    private static long findCalendar(ContentResolver cr) {
        String[] proj = {CalendarContract.Calendars._ID, CalendarContract.Calendars.IS_PRIMARY};
        long first = -1;
        try (Cursor cur = cr.query(CalendarContract.Calendars.CONTENT_URI, proj,
                CalendarContract.Calendars.CALENDAR_ACCESS_LEVEL + ">=? AND " + CalendarContract.Calendars.VISIBLE + "=1",
                new String[]{String.valueOf(CalendarContract.Calendars.CAL_ACCESS_CONTRIBUTOR)}, null)) {
            while (cur != null && cur.moveToNext()) {
                if (first < 0) first = cur.getLong(0);
                if (cur.getInt(1) == 1) return cur.getLong(0);
            }
        }
        return first;
    }

    /** Returns {added, updated, removed} or an error message in element 3. */
    static String[] run(Context ctx, JSONArray events) throws Exception {
        ContentResolver cr = ctx.getContentResolver();
        long calId = findCalendar(cr);
        if (calId < 0) return new String[]{"0", "0", "0", "No writable calendar found on this phone."};
        SharedPreferences sp = ctx.getSharedPreferences(PriceCheckWorker.PREFS, Context.MODE_PRIVATE);
        JSONObject map = new JSONObject(sp.getString("calMap", "{}"));
        JSONObject seen = new JSONObject();
        int added = 0, updated = 0, removed = 0;
        for (int k = 0; k < events.length(); k++) {
            JSONObject e = events.getJSONObject(k);
            String key = e.getString("key"), date = e.getString("date");
            long start = utcMidnight(date);
            ContentValues v = new ContentValues();
            v.put(CalendarContract.Events.TITLE, e.optString("title"));
            v.put(CalendarContract.Events.DESCRIPTION, e.optString("desc"));
            v.put(CalendarContract.Events.EVENT_LOCATION, e.optString("location"));
            v.put(CalendarContract.Events.DTSTART, start);
            v.put(CalendarContract.Events.DTEND, start + 86400000L);
            v.put(CalendarContract.Events.ALL_DAY, 1);
            v.put(CalendarContract.Events.EVENT_TIMEZONE, "UTC");
            long id = -1;
            String old = map.optString(key, "");
            if (!old.isEmpty()) {
                long oid = Long.parseLong(old.split("\\|")[0]);
                if (cr.update(ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI, oid), v, null, null) > 0) { id = oid; updated++; }
            }
            if (id < 0) {
                v.put(CalendarContract.Events.CALENDAR_ID, calId);
                Uri u = cr.insert(CalendarContract.Events.CONTENT_URI, v);
                if (u == null) continue;
                id = ContentUris.parseId(u);
                added++;
            }
            cr.delete(CalendarContract.Reminders.CONTENT_URI, CalendarContract.Reminders.EVENT_ID + "=?", new String[]{String.valueOf(id)});
            int mins = e.optInt("remind", 0);
            if (mins > 0) {
                ContentValues r = new ContentValues();
                r.put(CalendarContract.Reminders.EVENT_ID, id);
                r.put(CalendarContract.Reminders.MINUTES, mins);
                r.put(CalendarContract.Reminders.METHOD, CalendarContract.Reminders.METHOD_ALERT);
                cr.insert(CalendarContract.Reminders.CONTENT_URI, r);
            }
            seen.put(key, id + "|" + date);
        }
        // Remove events for games that are no longer upcoming-listed, but keep past ones.
        String today = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
        Iterator<String> it = map.keys();
        while (it.hasNext()) {
            String key = it.next();
            String[] parts = map.getString(key).split("\\|");
            if (seen.has(key)) continue;
            if (parts.length > 1 && parts[1].compareTo(today) >= 0) {
                cr.delete(ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI, Long.parseLong(parts[0])), null, null);
                removed++;
            } else {
                seen.put(key, map.getString(key));
            }
        }
        sp.edit().putString("calMap", seen.toString()).apply();
        return new String[]{String.valueOf(added), String.valueOf(updated), String.valueOf(removed), ""};
    }
}
