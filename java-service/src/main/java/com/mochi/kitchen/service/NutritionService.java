package com.mochi.kitchen.service;

import com.mochi.kitchen.model.NutritionProfile;
import java.util.List;
import java.util.Map;

/**
 * Strategy interface for recipe nutritional analysis.
 */
public interface NutritionService {
    NutritionProfile analyze(String title, int servings, List<Map<String, Object>> ingredients);
}

