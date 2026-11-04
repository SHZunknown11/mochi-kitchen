package com.mochi.kitchen.model;

import java.util.List;

/**
 * Data Transfer Object representing calculated kitchen preparation and cooking workload.
 */
public record KitchenWorkload(
    int estimatedPrepMinutes,
    int estimatedCookMinutes,
    int totalMinutes,
    String difficultyLevel,
    int difficultyStars,
    List<String> equipmentRequired,
    List<String> primaryCookingTechniques,
    String chefWorkloadTip
) {}

