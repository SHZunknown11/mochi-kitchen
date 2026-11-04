package com.mochi.kitchen.service;

import com.mochi.kitchen.model.NutritionProfile;
import java.util.*;

/**
 * Concrete implementation of NutritionService using macronutrient reference lookup.
 */
public class NutritionServiceImpl implements NutritionService {

    private static final Map<String, double[]> NUTRIENT_DB = new HashMap<>();

    static {
        // [Calories/100g, Protein g, Carbs g, Fat g, Fiber g]
        NUTRIENT_DB.put("tofu", new double[]{76, 8.1, 1.9, 4.8, 0.3});
        NUTRIENT_DB.put("chicken", new double[]{165, 31.0, 0.0, 3.6, 0.0});
        NUTRIENT_DB.put("egg", new double[]{143, 12.6, 0.7, 9.5, 0.0});
        NUTRIENT_DB.put("rice", new double[]{130, 2.7, 28.2, 0.3, 0.4});
        NUTRIENT_DB.put("noodles", new double[]{138, 4.5, 25.0, 2.1, 1.2});
        NUTRIENT_DB.put("spinach", new double[]{23, 2.9, 3.6, 0.4, 2.2});
        NUTRIENT_DB.put("carrot", new double[]{41, 0.9, 9.6, 0.2, 2.8});
        NUTRIENT_DB.put("onion", new double[]{40, 1.1, 9.3, 0.1, 1.7});
        NUTRIENT_DB.put("kimchi", new double[]{15, 1.1, 2.4, 0.5, 1.6});
        NUTRIENT_DB.put("mushroom", new double[]{22, 3.1, 3.3, 0.3, 1.0});
        NUTRIENT_DB.put("salmon", new double[]{208, 20.4, 0.0, 13.4, 0.0});
        NUTRIENT_DB.put("pork", new double[]{242, 27.0, 0.0, 14.0, 0.0});
        NUTRIENT_DB.put("milk", new double[]{60, 3.2, 5.0, 3.2, 0.0});
        NUTRIENT_DB.put("soy sauce", new double[]{53, 8.0, 4.9, 0.6, 0.8});
        NUTRIENT_DB.put("sesame oil", new double[]{884, 0.0, 0.0, 100.0, 0.0});
        NUTRIENT_DB.put("cabbage", new double[]{25, 1.3, 5.8, 0.1, 2.5});
        NUTRIENT_DB.put("potato", new double[]{77, 2.0, 17.5, 0.1, 2.2});
        NUTRIENT_DB.put("avocado", new double[]{160, 2.0, 8.5, 14.7, 6.7});
        NUTRIENT_DB.put("chickpeas", new double[]{164, 8.9, 27.4, 2.6, 7.6});
        NUTRIENT_DB.put("coconut milk", new double[]{230, 2.3, 5.5, 23.8, 2.2});
    }

    @Override
    public NutritionProfile analyze(String title, int servings, List<Map<String, Object>> ingredients) {
        if (servings <= 0) servings = 2;

        double totalCal = 0;
        double totalProtein = 0;
        double totalCarbs = 0;
        double totalFat = 0;
        double totalFiber = 0;

        for (Map<String, Object> ing : ingredients) {
            String name = String.valueOf(ing.getOrDefault("name", "")).toLowerCase().trim();
            double grams = estimateGrams(ing);

            double[] profile = findNutrientProfile(name);
            double factor = grams / 100.0;
            totalCal += profile[0] * factor;
            totalProtein += profile[1] * factor;
            totalCarbs += profile[2] * factor;
            totalFat += profile[3] * factor;
            totalFiber += profile[4] * factor;
        }

        double perServingCal = Math.max(80, totalCal / servings);
        double perServingProt = Math.round((totalProtein / servings) * 10.0) / 10.0;
        double perServingCarbs = Math.round((totalCarbs / servings) * 10.0) / 10.0;
        double perServingFat = Math.round((totalFat / servings) * 10.0) / 10.0;
        double perServingFiber = Math.round((totalFiber / servings) * 10.0) / 10.0;

        int healthScore = calculateHealthScore(perServingCal, perServingProt, perServingFat, perServingFiber);
        String rating = evaluateMacroBalance(perServingProt, perServingCarbs, perServingFat);

        Map<String, Object> details = new LinkedHashMap<>();
        details.put("servingsEvaluated", servings);
        details.put("proteinPercentCalories", Math.round((perServingProt * 4 / Math.max(1, perServingCal)) * 100));
        details.put("carbsPercentCalories", Math.round((perServingCarbs * 4 / Math.max(1, perServingCal)) * 100));
        details.put("fatPercentCalories", Math.round((perServingFat * 9 / Math.max(1, perServingCal)) * 100));
        details.put("engine", "Mochi Java Nutrition Engine v1.0");

        return new NutritionProfile(
            (int) Math.round(perServingCal),
            perServingProt,
            perServingCarbs,
            perServingFat,
            perServingFiber,
            healthScore,
            rating,
            details
        );
    }

    private double[] findNutrientProfile(String name) {
        for (Map.Entry<String, double[]> entry : NUTRIENT_DB.entrySet()) {
            if (name.contains(entry.getKey())) {
                return entry.getValue();
            }
        }
        // Default estimate for unidentified ingredient [Cal, P, C, F, Fiber]
        return new double[]{80, 2.0, 10.0, 2.0, 1.0};
    }

    private double estimateGrams(Map<String, Object> ing) {
        Object qtyObj = ing.get("quantity");
        Object unitObj = ing.get("unit");
        String measure = String.valueOf(ing.getOrDefault("measure", "")).toLowerCase();

        double qty = 1.0;
        if (qtyObj instanceof Number) {
            qty = ((Number) qtyObj).doubleValue();
        }

        String unit = unitObj != null ? String.valueOf(unitObj).toLowerCase() : "";
        if (unit.equals("g") || measure.contains("g")) return qty > 0 ? qty : 100.0;
        if (unit.equals("kg") || measure.contains("kg")) return qty * 1000.0;
        if (unit.equals("tbsp") || measure.contains("tbsp")) return qty * 15.0;
        if (unit.equals("tsp") || measure.contains("tsp")) return qty * 5.0;
        if (unit.equals("cup") || measure.contains("cup")) return qty * 200.0;
        if (unit.equals("ml") || measure.contains("ml")) return qty * 1.0;

        return 80.0; // standard single piece / default weight
    }

    private int calculateHealthScore(double cal, double protein, double fat, double fiber) {
        int score = 75;
        if (protein >= 15) score += 10;
        if (fiber >= 3) score += 10;
        if (fat <= 15) score += 5;
        if (cal > 850) score -= 15;
        if (cal < 250) score -= 5;
        return Math.max(40, Math.min(98, score));
    }

    private String evaluateMacroBalance(double p, double c, double f) {
        if (p >= 20 && c >= 30 && f <= 18) return "Excellent Balanced Macros";
        if (p >= 15 && f <= 20) return "High Protein & Lean";
        if (c >= 45) return "Energy Rich (Carb Dominant)";
        return "Nutritious & Wholesome";
    }
}

