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

    /** Local time at the given hour on the given yyyy-MM-dd. */
    static long localStart(String ymd, int hour) {
        String[] p = ymd.split("-");
        Calendar c = Calendar.getInstance();
        c.clear();
        c.set(Integer.parseInt(p[0]), Integer.parseInt(p[1]) - 1, Integer.parseInt(p[2]), hour, 0, 0);
        return c.getTimeInMillis();
    }

    /** Finds a writable calendar whose name matches wanted; falls back to the primary one. found[0] gets the name used. */
    private static long findCalendar(ContentResolver cr, String wanted, String[] found) {
        String[] proj = {CalendarContract.Calendars._ID, CalendarContract.Calendars.IS_PRIMARY, CalendarContract.Calendars.CALENDAR_DISPLAY_NAME, CalendarContract.Calendars.ACCOUNT_NAME};
        long first = -1, primary = -1; String firstName = "", primaryName = "";
        String w = wanted == null ? "" : wanted.trim().toLowerCase(Locale.US);
        try (Cursor cur = cr.query(CalendarContract.Calendars.CONTENT_URI, proj,
                CalendarContract.Calendars.CALENDAR_ACCESS_LEVEL + ">=? AND " + CalendarContract.Calendars.VISIBLE + "=1",
                new String[]{String.valueOf(CalendarContract.Calendars.CAL_ACCESS_CONTRIBUTOR)}, null)) {
            while (cur != null && cur.moveToNext()) {
                String dn = cur.getString(2) == null ? "" : cur.getString(2), an = cur.getString(3) == null ? "" : cur.getString(3);
                if (!w.isEmpty() && (dn.toLowerCase(Locale.US).contains(w) || an.toLowerCase(Locale.US).contains(w))) { found[0] = dn; found[1] = "match"; return cur.getLong(0); }
                if (first < 0) { first = cur.getLong(0); firstName = dn; }
                if (cur.getInt(1) == 1 && primary < 0) { primary = cur.getLong(0); primaryName = dn; }
            }
        }
        long id = primary >= 0 ? primary : first;
        found[0] = primary >= 0 ? primaryName : firstName; found[1] = "fallback";
        return id;
    }

    /** Returns {added, updated, removed} or an error message in element 3. */
    static String[] run(Context ctx, JSONArray events, String calName, boolean only) throws Exception {
        ContentResolver cr = ctx.getContentResolver();
        String[] found = {"", ""};
        long calId = findCalendar(cr, calName, found);
        if (calId < 0) return new String[]{"0", "0", "0", "No writable calendar found on this phone.", ""};
        SharedPreferences sp = ctx.getSharedPreferences(PriceCheckWorker.PREFS, Context.MODE_PRIVATE);
        JSONObject map = new JSONObject(sp.getString("calMap", "{}"));
        JSONObject seen = new JSONObject();
        int added = 0, updated = 0, removed = 0;
        for (int k = 0; k < events.length(); k++) {
            JSONObject e = events.getJSONObject(k);
            String key = e.getString("key"), date = e.getString("date");
            long start = localStart(date, e.optInt("hour", 20));
            ContentValues v = new ContentValues();
            v.put(CalendarContract.Events.TITLE, e.optString("title"));
            v.put(CalendarContract.Events.DESCRIPTION, e.optString("desc"));
            v.put(CalendarContract.Events.EVENT_LOCATION, e.optString("location"));
            v.put(CalendarContract.Events.DTSTART, start);
            v.put(CalendarContract.Events.DTEND, start + 3L * 3600000L);
            v.put(CalendarContract.Events.ALL_DAY, 0);
            v.put(CalendarContract.Events.EVENT_TIMEZONE, java.util.TimeZone.getDefault().getID());
            long id = -1;
            String old = map.optString(key, "");
            if (!old.isEmpty()) {
                String[] op = old.split("\\|");
                long oid = Long.parseLong(op[0]);
                boolean sameCal = op.length > 2 && op[2].equals(String.valueOf(calId));
                if (!sameCal) { cr.delete(ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI, oid), null, null); }
                else if (cr.update(ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI, oid), v, null, null) > 0) { id = oid; updated++; }
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
            seen.put(key, id + "|" + date + "|" + calId);
        }
        // Remove events for games that are no longer upcoming-listed, but keep past ones.
        String today = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
        Iterator<String> it = map.keys();
        while (it.hasNext()) {
            String key = it.next();
            String[] parts = map.getString(key).split("\\|");
            if (seen.has(key)) continue;
            if (!only && parts.length > 1 && parts[1].compareTo(today) >= 0) {
                cr.delete(ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI, Long.parseLong(parts[0])), null, null);
                removed++;
            } else {
                seen.put(key, map.getString(key));
            }
        }
        sp.edit().putString("calMap", seen.toString()).apply();
        return new String[]{String.valueOf(added), String.valueOf(updated), String.valueOf(removed), "", found[0] + ("match".equals(found[1]) ? "" : " (no calendar named " + calName + " found)")};
    }
}
