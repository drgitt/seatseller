package com.drgitt.seatseller;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

import org.json.JSONObject;

/** Home-screen widget: next game, market low and the advice. Text is pushed from the app and refreshed after each price check. */
public class WidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        update(ctx);
    }

    static void update(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, WidgetProvider.class));
        if (ids == null || ids.length == 0) return;
        SharedPreferences sp = ctx.getSharedPreferences(PriceCheckWorker.PREFS, Context.MODE_PRIVATE);
        String title = sp.getString("wTitle", "Open SeatSeller"), sub = sp.getString("wSub", ""), key = sp.getString("wKey", "");
        String low = sp.getString("wLow", "");
        try {
            JSONObject root = new JSONObject(sp.getString("lastPrices", "{}"));
            JSONObject g = root.optJSONObject("games");
            if (g != null && !key.isEmpty()) {
                JSONObject x = g.optJSONObject(key);
                if (x != null && !x.isNull("low")) low = "Market low $" + Math.round(x.optDouble("low"));
            }
        } catch (Exception ignored) { }
        RemoteViews rv = new RemoteViews(ctx.getPackageName(), R.layout.widget_next);
        rv.setTextViewText(R.id.w_title, title);
        rv.setTextViewText(R.id.w_sub, sub);
        rv.setTextViewText(R.id.w_low, low);
        Intent launch = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
        if (launch != null) {
            rv.setOnClickPendingIntent(R.id.w_root, PendingIntent.getActivity(ctx, 0, launch, PendingIntent.FLAG_IMMUTABLE));
        }
        mgr.updateAppWidget(ids, rv);
    }
}
