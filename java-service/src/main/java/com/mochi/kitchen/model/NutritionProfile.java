package com.mochi.kitchen.model;

import java.util.Map;

/**
 * Data Transfer Object representing calculated nutritional breakdown.
 */
public record NutritionProfile(
    int calories,
    double proteinGrams,
    double carbsGrams,
    double fatGrams,
    double fiberGrams,
    int healthScore,
    String macroBalanceRating,
    Map<String, Object> details
) {}

