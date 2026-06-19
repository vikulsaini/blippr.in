# Production calling architecture: Native OS & Background Push Integrations

To scale Varta from a mobile-first Web/PWA prototype to a premium product-ready calling app (similar to WhatsApp or Telegram), it is necessary to integrate WebRTC with native hardware and OS subsystems. This document details the native integrations required when wrapping this web app using native shells (such as Capacitor, Cordova, or custom native WebViews).

---

## 1. Native iOS Integration: CallKit Framework

Apple strictly blocks standard web apps or WebViews from displaying custom incoming call screens when the device is locked or the application has been terminated. To wake the phone and trigger the standard dialer slider, you must integrate your wrapper with the native **CallKit** SDK.

### Lifecycle of an Incoming Call on iOS

```
[VoIP Push Event] ──► [CallKit Service] ──► [Native Ringing UI Slides Up]
                                                       │
                                            (User presses Accept)
                                                       │
                                                       ▼
[iOS Kernel launches App] ──► [WebView mounts with call ID] ──► [WebRTC Audio/Video Connects]
```

### Swift Integration Blueprint

Your native wrapper listens for VoIP pushes via PushKit and registers calls with `CXProvider`:

```swift
import CallKit
import PushKit

class CallManager: NSObject, CXProviderDelegate {
    let provider: CXProvider

    override init() {
        let configuration = CXProviderConfiguration(localizedName: "blippr.in")
        configuration.supportsVideo = true
        configuration.maximumCallGroups = 1
        configuration.supportedHandleTypes = [.phoneNumber, .emailAddress]
        
        provider = CXProvider(configuration: configuration)
        super.init()
        provider.setDelegate(self, queue: nil)
    }

    func reportIncomingCall(uuid: UUID, handle: String, hasVideo: Bool) {
        let update = CXCallUpdate()
        update.remoteHandle = CXHandle(type: .emailAddress, value: handle)
        update.hasVideo = hasVideo

        provider.reportNewIncomingCall(with: uuid, update: update) { error in
            if error == nil {
                // Background execution thread is awake: trigger signaling socket connect
                NotificationCenter.default.post(name: .didReceiveVoIPCall, object: uuid)
            }
        }
    }

    // CXProviderDelegate Handlers
    func provider(_ provider: CXProvider, perform action: CXAnswerCallAction) {
        // 1. Wake WebView and direct browser history router to /app?chat=<callPeerId>
        // 2. Resolve action to notify OS audio is connected
        action.fulfill()
    }

    func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
        // 1. Send call:end signaling message via WebSocket
        // 2. Teardown native WebRTC audio pipelines
        action.fulfill()
    }
}
```

---

## 2. Native Android Integration: ConnectionService & Full-Screen Intents

Android offers more flexibility, allowing you to launch custom full-screen interfaces directly over the lock screen. To implement this, you must configure a native Android **Service** using **Full-Screen Intents** and optionally subclass **ConnectionService**.

### AndroidManifest.xml Configuration

The custom incoming call Activity must override lock-screen locks and request high-priority wake permissions:

```xml
<uses-permission android:name="android.permission.USE_FULL_SCREEN_INTENT" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-permission android:name="android.permission.DISABLE_KEYGUARD" />

<activity
    android:name=".IncomingCallActivity"
    android:showWhenLocked="true"
    android:turnScreenOn="true"
    android:launchMode="singleInstance"
    android:excludeFromRecents="true"
    android:screenOrientation="portrait">
</activity>
```

### Kotlin Notification & Full-Screen Intent Trigger

When a silent VoIP push arrives via Firebase Cloud Messaging (FCM), launch the lock-screen overlay Activity:

```kotlin
class CallingNotificationService : FirebaseMessagingService() {
    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        val callId = remoteMessage.data["callId"] ?: return
        val callerName = remoteMessage.data["callerName"] ?: "Blippr friend"

        val intent = Intent(this, IncomingCallActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("callId", callId)
        }
        
        val fullScreenPendingIntent = PendingIntent.getActivity(
            this, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notificationBuilder = NotificationCompat.Builder(this, "calls_channel")
            .setSmallIcon(R.drawable.ic_call)
            .setContentTitle("Incoming call")
            .setContentText("$callerName is calling you")
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setFullScreenIntent(fullScreenPendingIntent, true) // Forces wake and displays full screen layout
            .setAutoCancel(false)
            .setOngoing(true)

        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.notify(1001, notificationBuilder.build())
    }
}
```

---

## 3. VoIP Silent Push Networks: APNs PushKit & FCM Data Channels

Standard push notifications are throttled by the OS under low battery conditions (Apple's power manager or Android Doze mode). A call push notification must arrive in less than **1.0 second** or it will time out. 

To bypass battery locks, use high-priority silent VoIP payloads:
1. **iOS (APNs PushKit)**: Packets are routed to the Apple PushKit daemon. These notifications do not display a message box; instead, they wake the native calling thread for 30 seconds to connect the signaling socket and register the call with CallKit.
2. **Android (FCM Data Payloads)**: Payloads are configured with `priority: "high"` and contain data keys only (no `notification` object). The system routes these directly to the device background thread, launching the receiver activity instantly.

### Recommended Node.js Server Push Payload Structure

```javascript
// Example backend VoIP Push payload configuration
const pushPayload = {
  // FCM Android Configuration
  android: {
    priority: 'high',
    data: {
      type: 'call',
      callId: call.callId,
      callerName: caller.name,
      callerAvatar: caller.avatar,
      video: String(call.type === 'video')
    }
  },
  // APNs iOS Configuration (PushKit)
  apns: {
    headers: {
      'apns-priority': '10',
      'apns-push-type': 'voip', // Critical: identifies it as a VoIP packet
      'apns-topic': 'in.blippr.voip'
    },
    payload: {
      aps: {
        'content-available': 1 // Silent wake-up flag
      },
      callId: call.callId,
      callerName: caller.name,
      video: call.type === 'video'
    }
  }
};
```

---

## 4. Background Signaling Handshake (Avoiding Accept Lag)

To avoid call setup stutter when a user taps "Accept," the signaling pipeline starts *before* the user interacts with the UI:
1. As soon as the background notification wakes the application thread, the app opens a hidden socket connection to the Signaling server.
2. The client fetches standard WebRTC ICE candidates (`RTCIceServer` STUN/TURN pools) and starts preparing local media tracks.
3. By the time the user slides to accept, the network path has already been discovered (ice collection is complete), reducing setup latency to under **150 milliseconds**.
