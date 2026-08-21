package com.smartattendance.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // ngrok serves an interstitial warning to browser-like User-Agents on free
        // domains. A non-browser UA makes it serve the app directly to the WebView.
        getBridge().getWebView().getSettings().setUserAgentString("SmartCampusPresence/1.0");
    }
}
