package com.aivisionmonitor

import android.app.Activity
import android.graphics.Bitmap
import android.graphics.Color
import android.os.Handler
import android.os.Looper
import android.view.PixelCopy
import android.view.SurfaceView
import android.view.View
import android.view.ViewGroup
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.io.FileOutputStream

class ScreenCaptureModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "ScreenCaptureModule"

    // Store downscaled previous frame for motion comparison
    private var prevPixels: IntArray? = null
    private val SAMPLE_WIDTH = 64
    private val SAMPLE_HEIGHT = 48

    @ReactMethod
    fun captureScreen(promise: Promise) {
        val activity: Activity? = reactApplicationContext.currentActivity
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "No current activity")
            return
        }

        activity.runOnUiThread {
            try {
                val surfaceView = findSurfaceView(activity.window.decorView)
                if (surfaceView == null || !surfaceView.holder.surface.isValid) {
                    promise.reject("NO_SURFACE", "No valid SurfaceView found")
                    return@runOnUiThread
                }

                val width = surfaceView.width
                val height = surfaceView.height
                if (width <= 0 || height <= 0) {
                    promise.reject("INVALID_SIZE", "SurfaceView has invalid size")
                    return@runOnUiThread
                }

                val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)

                PixelCopy.request(surfaceView, bitmap, { result: Int ->
                    if (result == PixelCopy.SUCCESS) {
                        try {
                            val file = File(
                                reactApplicationContext.cacheDir,
                                "pixelcopy-${System.currentTimeMillis()}.jpg"
                            )
                            FileOutputStream(file).use { out ->
                                bitmap.compress(Bitmap.CompressFormat.JPEG, 60, out)
                            }
                            bitmap.recycle()
                            promise.resolve("file://${file.absolutePath}")
                        } catch (e: Exception) {
                            bitmap.recycle()
                            promise.reject("SAVE_ERROR", e.message)
                        }
                    } else {
                        bitmap.recycle()
                        promise.reject("CAPTURE_ERROR", "PixelCopy failed with code: $result")
                    }
                }, Handler(Looper.getMainLooper()))
            } catch (e: Exception) {
                promise.reject("CAPTURE_ERROR", e.message)
            }
        }
    }

    /**
     * Capture a frame and compare it to the previous frame.
     * Returns the motion score (0-100) as a percentage of changed pixels.
     * Returns -1 on the first frame (no previous to compare).
     */
    @ReactMethod
    fun detectMotion(promise: Promise) {
        val activity: Activity? = reactApplicationContext.currentActivity
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "No current activity")
            return
        }

        activity.runOnUiThread {
            try {
                val surfaceView = findSurfaceView(activity.window.decorView)
                if (surfaceView == null || !surfaceView.holder.surface.isValid) {
                    promise.reject("NO_SURFACE", "No valid SurfaceView found")
                    return@runOnUiThread
                }

                val width = surfaceView.width
                val height = surfaceView.height
                if (width <= 0 || height <= 0) {
                    promise.reject("INVALID_SIZE", "SurfaceView has invalid size")
                    return@runOnUiThread
                }

                val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)

                PixelCopy.request(surfaceView, bitmap, { result: Int ->
                    if (result == PixelCopy.SUCCESS) {
                        try {
                            // Downscale for fast comparison
                            val small = Bitmap.createScaledBitmap(bitmap, SAMPLE_WIDTH, SAMPLE_HEIGHT, true)
                            bitmap.recycle()

                            val currPixels = IntArray(SAMPLE_WIDTH * SAMPLE_HEIGHT)
                            small.getPixels(currPixels, 0, SAMPLE_WIDTH, 0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT)
                            small.recycle()

                            val prev = prevPixels
                            prevPixels = currPixels

                            if (prev == null) {
                                // First frame, no comparison possible
                                promise.resolve(-1.0)
                                return@request
                            }

                            // Compare pixels: count significantly changed pixels
                            var changedPixels = 0
                            val threshold = 30 // per-channel difference threshold
                            for (i in currPixels.indices) {
                                val c = currPixels[i]
                                val p = prev[i]
                                val dr = Math.abs(Color.red(c) - Color.red(p))
                                val dg = Math.abs(Color.green(c) - Color.green(p))
                                val db = Math.abs(Color.blue(c) - Color.blue(p))
                                if (dr > threshold || dg > threshold || db > threshold) {
                                    changedPixels++
                                }
                            }

                            val motionScore = (changedPixels.toDouble() / currPixels.size) * 100.0
                            promise.resolve(motionScore)
                        } catch (e: Exception) {
                            promise.reject("COMPARE_ERROR", e.message)
                        }
                    } else {
                        bitmap.recycle()
                        promise.reject("CAPTURE_ERROR", "PixelCopy failed with code: $result")
                    }
                }, Handler(Looper.getMainLooper()))
            } catch (e: Exception) {
                promise.reject("CAPTURE_ERROR", e.message)
            }
        }
    }

    private fun findSurfaceView(view: View): SurfaceView? {
        if (view is SurfaceView) return view
        if (view is ViewGroup) {
            for (i in 0 until view.childCount) {
                val found = findSurfaceView(view.getChildAt(i))
                if (found != null) return found
            }
        }
        return null
    }
}
