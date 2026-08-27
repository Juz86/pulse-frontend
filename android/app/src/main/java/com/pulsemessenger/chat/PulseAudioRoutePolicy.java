package com.pulsemessenger.chat;

import java.util.List;

final class PulseAudioRoutePolicy {
    private PulseAudioRoutePolicy() {}

    static int choose(
        List<PulseAudioRoute> routes,
        Integer currentRouteId,
        Integer userRouteId,
        Integer newlyConnectedRouteId,
        boolean videoCall
    ) {
        if (routes == null || routes.isEmpty()) return -1;
        PulseAudioRoute userRoute = find(routes, userRouteId);
        if (userRoute != null) return userRoute.id;

        PulseAudioRoute newlyConnected = find(routes, newlyConnectedRouteId);
        if (newlyConnected != null && newlyConnected.isExternal()) return newlyConnected.id;

        PulseAudioRoute current = find(routes, currentRouteId);
        if (current != null) return current.id;

        PulseAudioRoute bestExternal = null;
        for (PulseAudioRoute route : routes) {
            if (!route.isExternal()) continue;
            if (bestExternal == null || externalPriority(route.kind) > externalPriority(bestExternal.kind)) {
                bestExternal = route;
            }
        }
        if (bestExternal != null) return bestExternal.id;

        PulseAudioRoute preferredBuiltIn = findKind(
            routes,
            videoCall ? PulseAudioRoute.Kind.SPEAKER : PulseAudioRoute.Kind.EARPIECE
        );
        if (preferredBuiltIn != null) return preferredBuiltIn.id;
        PulseAudioRoute speaker = findKind(routes, PulseAudioRoute.Kind.SPEAKER);
        return speaker == null ? routes.get(0).id : speaker.id;
    }

    static boolean contains(List<PulseAudioRoute> routes, Integer routeId) {
        return find(routes, routeId) != null;
    }

    private static PulseAudioRoute find(List<PulseAudioRoute> routes, Integer routeId) {
        if (routeId == null) return null;
        for (PulseAudioRoute route : routes) {
            if (route.id == routeId) return route;
        }
        return null;
    }

    private static PulseAudioRoute findKind(List<PulseAudioRoute> routes, PulseAudioRoute.Kind kind) {
        for (PulseAudioRoute route : routes) {
            if (route.kind == kind) return route;
        }
        return null;
    }

    private static int externalPriority(PulseAudioRoute.Kind kind) {
        if (kind == PulseAudioRoute.Kind.BLUETOOTH) return 3;
        if (kind == PulseAudioRoute.Kind.WIRED) return 2;
        if (kind == PulseAudioRoute.Kind.USB) return 1;
        return 0;
    }
}
