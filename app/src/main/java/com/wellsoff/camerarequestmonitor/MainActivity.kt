package com.wellsoff.camerarequestmonitor

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.view.inputmethod.EditorInfo
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.EditText
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature

class MainActivity : Activity() {
    private lateinit var webView: WebView
    private lateinit var urlEditText: EditText
    private lateinit var cameraMonitorScript: String
    private var pendingPermissionRequest: PermissionRequest? = null
    private var pendingPermissionCode = 0

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        urlEditText = findViewById(R.id.urlEditText)
        webView = findViewById(R.id.webView)
        val goButton = findViewById<Button>(R.id.goButton)
        cameraMonitorScript = assets.open("camera_monitor.js").bufferedReader().use { it.readText() }

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            cacheMode = WebSettings.LOAD_DEFAULT
            mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
            userAgentString = "$userAgentString CameraRequestMonitor/1.0"
        }
        installDocumentStartMonitor()

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                return false
            }

            override fun onPageCommitVisible(view: WebView, url: String) {
                injectCameraMonitor()
            }

            override fun onPageFinished(view: WebView, url: String) {
                injectCameraMonitor()
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                runOnUiThread { handleWebPermissionRequest(request) }
            }

            override fun onPermissionRequestCanceled(request: PermissionRequest) {
                if (pendingPermissionRequest == request) {
                    pendingPermissionRequest = null
                }
            }
        }

        goButton.setOnClickListener { loadUrlFromInput() }
        urlEditText.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_GO) {
                loadUrlFromInput()
                true
            } else {
                false
            }
        }

        if (savedInstanceState == null) {
            webView.loadUrl(getString(R.string.default_url))
        } else {
            webView.restoreState(savedInstanceState)
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    private fun loadUrlFromInput() {
        val normalizedUrl = normalizeUrl(urlEditText.text.toString())
        urlEditText.setText(normalizedUrl)
        webView.loadUrl(normalizedUrl)
    }

    private fun normalizeUrl(rawUrl: String): String {
        val trimmed = rawUrl.trim()
        if (trimmed.isBlank()) return getString(R.string.default_url)
        val uri = Uri.parse(trimmed)
        return if (uri.scheme.isNullOrBlank()) "https://$trimmed" else trimmed
    }

    private fun injectCameraMonitor() {
        webView.evaluateJavascript(cameraMonitorScript, null)
    }

    private fun installDocumentStartMonitor() {
        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            WebViewCompat.addDocumentStartJavaScript(webView, cameraMonitorScript, setOf("*"))
        }
    }

    private fun handleWebPermissionRequest(request: PermissionRequest) {
        val missingPermissions = mutableListOf<String>()

        if (request.resources.contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE) &&
            checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED
        ) {
            missingPermissions.add(Manifest.permission.CAMERA)
        }

        if (request.resources.contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE) &&
            checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED
        ) {
            missingPermissions.add(Manifest.permission.RECORD_AUDIO)
        }

        if (missingPermissions.isEmpty()) {
            grantAllowedWebResources(request)
            return
        }

        pendingPermissionRequest = request
        pendingPermissionCode += 1
        requestPermissions(missingPermissions.toTypedArray(), pendingPermissionCode)
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        val request = pendingPermissionRequest ?: return
        pendingPermissionRequest = null
        grantAllowedWebResources(request)
    }

    private fun grantAllowedWebResources(request: PermissionRequest) {
        val grantedResources = request.resources.filter { resource ->
            when (resource) {
                PermissionRequest.RESOURCE_VIDEO_CAPTURE ->
                    checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
                PermissionRequest.RESOURCE_AUDIO_CAPTURE ->
                    checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
                else -> false
            }
        }.toTypedArray()

        if (grantedResources.isEmpty()) {
            request.deny()
        } else {
            request.grant(grantedResources)
        }
    }

    @Suppress("DEPRECATION")
    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }

    override fun onDestroy() {
        pendingPermissionRequest?.deny()
        pendingPermissionRequest = null
        webView.stopLoading()
        webView.webChromeClient = null
        webView.webViewClient = WebViewClient()
        webView.destroy()
        super.onDestroy()
    }
}
