package com.mochi.kitchen.model;

import java.util.List;

/**
 * Data Transfer Object representing chef recommendations and seasonal culinary insights.
 */
public record ChefInsight(
    String dishName,
    String culinaryProfile,
    String flavorHarmonies,
    List<String> proTips,
    String wineOrTeaPairing,
    String seasonality
) {}

