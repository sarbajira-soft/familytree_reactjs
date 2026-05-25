package com.familyss.app;

import android.Manifest;
import android.app.ActivityManager;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.text.TextUtils;

import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

public class FamilyssFirebaseMessagingService extends MessagingService {
    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);

        if (remoteMessage == null || remoteMessage.getData().isEmpty()) {
            return;
        }

        if (isAppInForeground()) {
            return;
        }

        showSystemNotification(remoteMessage);
    }

    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
    }

    private void showSystemNotification(RemoteMessage remoteMessage) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ActivityCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
            return;
        }

        Map<String, String> data = remoteMessage.getData();
        String title = safeText(
            data.get("title"),
            data.get("senderName"),
            "Familyss"
        );
        String body = safeText(
            data.get("body"),
            "You have a new notification"
        );
        String notificationType = safeText(
            data.get("notificationType"),
            data.get("type"),
            "SYSTEM"
        );
        String channelId = FamilyssNotificationChannels.resolveChannelId(notificationType);
        FamilyssNotificationChannels.ensureChannels(this);

        Intent launchIntent = buildLaunchIntent(remoteMessage);
        int requestCode = resolveNotificationId(data, remoteMessage);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this,
            requestCode,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, channelId)
            .setSmallIcon(getApplicationInfo().icon)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .setPriority(resolvePriority(channelId))
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setContentIntent(pendingIntent);

        if (FamilyssNotificationChannels.CHAT.equals(channelId)) {
            builder.setCategory(NotificationCompat.CATEGORY_MESSAGE);
            String conversationId = safeText(data.get("conversationId"));
            if (!TextUtils.isEmpty(conversationId)) {
                builder.setGroup("chat-" + conversationId);
            }
        } else if (FamilyssNotificationChannels.REQUESTS.equals(channelId)) {
            builder.setCategory(NotificationCompat.CATEGORY_REMINDER);
        } else {
            builder.setCategory(NotificationCompat.CATEGORY_SOCIAL);
        }

        NotificationManagerCompat.from(this).notify(
            notificationTag(notificationType, data),
            requestCode,
            builder.build()
        );
    }

    private Intent buildLaunchIntent(RemoteMessage remoteMessage) {
        Map<String, String> data = remoteMessage.getData();
        Intent launchIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (launchIntent == null) {
            launchIntent = new Intent(this, MainActivity.class);
        }

        String messageId = safeText(
            remoteMessage.getMessageId(),
            data.get("notificationId"),
            String.valueOf(System.currentTimeMillis())
        );

        launchIntent.setFlags(
            Intent.FLAG_ACTIVITY_CLEAR_TOP
                | Intent.FLAG_ACTIVITY_SINGLE_TOP
                | Intent.FLAG_ACTIVITY_NEW_TASK
        );
        launchIntent.setAction("com.familyss.app.NOTIFICATION_TAP." + messageId);
        launchIntent.setData(buildNotificationUri(data));
        launchIntent.putExtra("google.message_id", messageId);

        for (Map.Entry<String, String> entry : data.entrySet()) {
            launchIntent.putExtra(entry.getKey(), entry.getValue());
        }

        return launchIntent;
    }

    private Uri buildNotificationUri(Map<String, String> data) {
        String scheme = getString(R.string.custom_url_scheme);
        Uri.Builder builder = new Uri.Builder()
            .scheme(scheme)
            .authority("notification");

        appendQuery(builder, "target", safeText(data.get("deepLink"), data.get("path")));
        appendQuery(builder, "notificationType", safeText(data.get("notificationType"), data.get("type")));
        appendQuery(builder, "conversationId", safeText(data.get("conversationId")));
        appendQuery(builder, "eventId", safeText(data.get("eventId")));
        appendQuery(builder, "notificationId", safeText(data.get("notificationId")));
        appendQuery(builder, "familyCode", safeText(data.get("familyCode")));

        return builder.build();
    }

    private void appendQuery(Uri.Builder builder, String key, String value) {
        if (!TextUtils.isEmpty(value)) {
            builder.appendQueryParameter(key, value);
        }
    }

    private boolean isAppInForeground() {
        ActivityManager.RunningAppProcessInfo appProcessInfo =
            new ActivityManager.RunningAppProcessInfo();
        ActivityManager.getMyMemoryState(appProcessInfo);
        int importance = appProcessInfo.importance;
        return importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND
            || importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_VISIBLE;
    }

    private int resolvePriority(String channelId) {
        if (FamilyssNotificationChannels.CHAT.equals(channelId)
            || FamilyssNotificationChannels.REQUESTS.equals(channelId)) {
            return NotificationCompat.PRIORITY_HIGH;
        }
        return NotificationCompat.PRIORITY_DEFAULT;
    }

    private int resolveNotificationId(Map<String, String> data, RemoteMessage remoteMessage) {
        String rawId = safeText(
            data.get("notificationId"),
            data.get("messageId"),
            remoteMessage.getMessageId(),
            data.get("conversationId")
        );
        try {
            return Integer.parseInt(rawId);
        } catch (NumberFormatException ignored) {
            return Math.abs(rawId.hashCode());
        }
    }

    private String notificationTag(String notificationType, Map<String, String> data) {
        return safeText(notificationType, "system") + ":" + safeText(
            data.get("notificationId"),
            data.get("conversationId"),
            data.get("eventId"),
            String.valueOf(System.currentTimeMillis())
        );
    }

    private String safeText(String... values) {
        if (values == null) {
            return "";
        }

        for (String value : values) {
            if (!TextUtils.isEmpty(value)) {
                return value.trim();
            }
        }

        return "";
    }
}
