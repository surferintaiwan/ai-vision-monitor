package com.aivisionmonitor

import android.content.Context
import android.media.AudioManager
import android.os.Handler
import android.os.Looper
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class AudioRoutingModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "AudioRoutingModule"

    private val handler = Handler(Looper.getMainLooper())
    private var speakerRunnable: Runnable? = null

    @ReactMethod
    fun setSpeakerOn(promise: Promise) {
        try {
            // Stop any previous polling
            speakerRunnable?.let { handler.removeCallbacks(it) }

            // Try immediately and then retry several times to fight WebRTC overrides
            val runnable = object : Runnable {
                var attempts = 0
                override fun run() {
                    try {
                        val audioManager = reactApplicationContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
                        audioManager.mode = AudioManager.MODE_IN_COMMUNICATION
                        audioManager.isSpeakerphoneOn = true
                        android.util.Log.i("AudioRoutingModule", "Speakerphone ON (attempt $attempts, actual=${audioManager.isSpeakerphoneOn})")
                    } catch (e: Exception) {
                        android.util.Log.w("AudioRoutingModule", "Failed: ${e.message}")
                    }
                    attempts++
                    if (attempts < 10) {
                        handler.postDelayed(this, 1000)
                    }
                }
            }
            speakerRunnable = runnable
            runnable.run()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("AUDIO_ERROR", e.message)
        }
    }

    @ReactMethod
    fun setSpeakerOff(promise: Promise) {
        try {
            speakerRunnable?.let { handler.removeCallbacks(it) }
            speakerRunnable = null
            val audioManager = reactApplicationContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
            audioManager.isSpeakerphoneOn = false
            audioManager.mode = AudioManager.MODE_NORMAL
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("AUDIO_ERROR", e.message)
        }
    }
}
