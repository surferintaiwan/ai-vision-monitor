package com.aivisionmonitor

import android.content.Context
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Build
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
            speakerRunnable?.let { handler.removeCallbacks(it) }

            val runnable = object : Runnable {
                var attempts = 0
                override fun run() {
                    try {
                        val audioManager = reactApplicationContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager

                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                            // Android 12+: use setCommunicationDevice API
                            val speaker = audioManager.availableCommunicationDevices
                                .firstOrNull { it.type == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER }
                            if (speaker != null) {
                                val success = audioManager.setCommunicationDevice(speaker)
                                android.util.Log.i("AudioRoutingModule", "setCommunicationDevice(speaker) attempt $attempts, success=$success")
                            } else {
                                android.util.Log.w("AudioRoutingModule", "No built-in speaker found in available devices")
                            }
                        } else {
                            // Android 11 and below: use legacy API
                            audioManager.mode = AudioManager.MODE_IN_COMMUNICATION
                            audioManager.isSpeakerphoneOn = true
                            android.util.Log.i("AudioRoutingModule", "Speakerphone ON (attempt $attempts, actual=${audioManager.isSpeakerphoneOn})")
                        }
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

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                audioManager.clearCommunicationDevice()
            } else {
                audioManager.isSpeakerphoneOn = false
                audioManager.mode = AudioManager.MODE_NORMAL
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("AUDIO_ERROR", e.message)
        }
    }
}
