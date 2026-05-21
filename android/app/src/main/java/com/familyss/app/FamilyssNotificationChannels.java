package com.familyss.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.os.Build;

import java.util.Arrays;
import java.util.List;

final class FamilyssNotificationChannels {
    static final String CHAT = "familyss-chat";
    static final String SOCIAL = "familyss-social";
    static final String REQUESTS = "familyss-requests";
    static final String SYSTEM = "familyss-system";

    private FamilyssNotificationChannels() {}

    static void ensureChannels(Context context) {
        if (context == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }

        NotificationManager notificationManager =
            context.getSystemService(NotificationManager.class);
        if (notificationManager == null) {
            return;
        }

        NotificationChannel chatChannel = new NotificationChannel(
            CHAT,
            "Chat",
            NotificationManager.IMPORTANCE_HIGH
        );
        chatChannel.setDescription("Direct and group chat messages");
        chatChannel.enableVibration(true);

        NotificationChannel socialChannel = new NotificationChannel(
            SOCIAL,
            "Social",
            NotificationManager.IMPORTANCE_DEFAULT
        );
        socialChannel.setDescription("Likes, comments, and family activity");
        socialChannel.enableVibration(true);

        NotificationChannel requestChannel = new NotificationChannel(
            REQUESTS,
            "Requests",
            NotificationManager.IMPORTANCE_HIGH
        );
        requestChannel.setDescription("Family requests and approvals");
        requestChannel.enableVibration(true);

        NotificationChannel systemChannel = new NotificationChannel(
            SYSTEM,
            "System",
            NotificationManager.IMPORTANCE_DEFAULT
        );
        systemChannel.setDescription("System and reminder notifications");
        systemChannel.enableVibration(true);

        List<NotificationChannel> channels = Arrays.asList(
            chatChannel,
            socialChannel,
            requestChannel,
            systemChannel
        );
        notificationManager.createNotificationChannels(channels);
    }

    static String resolveChannelId(String notificationType) {
        String normalizedType = notificationType == null
            ? ""
            : notificationType.trim().toUpperCase();

        switch (normalizedType) {
            case "CHAT_MESSAGE":
            case "CHAT_MENTION":
                return CHAT;
            case "FAMILY_JOIN_REQUEST":
            case "FAMILY_ASSOCIATION_REQUEST":
            case "FAMILY_ASSOCIATION_ACCEPTED":
            case "FAMILY_ASSOCIATION_REJECTED":
            case "TREE_LINK_REQUEST":
            case "FAMILY_MEMBER_APPROVED":
            case "FAMILY_JOIN_REJECTED":
                return REQUESTS;
            case "POST_LIKE":
            case "POST_COMMENT":
            case "GALLERY_SHARED":
            case "FAMILY_POST_CREATED":
            case "EVENT_CREATED":
            case "EVENT_REMINDER":
                return SOCIAL;
            default:
                return SYSTEM;
        }
    }
}
