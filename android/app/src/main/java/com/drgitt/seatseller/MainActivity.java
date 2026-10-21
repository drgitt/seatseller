package com.drgitt.seatseller;

import android.os.Bundle;

import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

import com.getcapacitor.BridgeActivity;

import java.util.concurrent.TimeUnit;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SeatSellerPlugin.class);
        super.onCreate(savedInstanceState);
        PriceCheckWorker.ensureChannel(this);
        schedulePriceChecks();
        Recurring.scheduleAll(this);
    }

    private void schedulePriceChecks() {
        Constraints constraints = new Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build();
        PeriodicWorkRequest request = new PeriodicWorkRequest.Builder(PriceCheckWorker.class, 3, TimeUnit.HOURS)
                .setConstraints(constraints)
                .build();
        WorkManager.getInstance(getApplicationContext())
                .enqueueUniquePeriodicWork("seatseller-price-check", ExistingPeriodicWorkPolicy.KEEP, request);
    }
}
