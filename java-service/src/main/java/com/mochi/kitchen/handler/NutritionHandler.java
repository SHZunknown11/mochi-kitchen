package com.mochi.kitchen.handler;

import com.mochi.kitchen.model.NutritionProfile;
import com.mochi.kitchen.service.NutritionService;
import com.mochi.kitchen.util.SimpleJson;
import com.sun.net.httpserver.HttpExchange;
import java.util.*;

/**
 * Endpoint /api/java/nutrition receiving ingredients and calculating full nutritional breakdown.
 */
public class NutritionHandler extends BaseHandler {

    private final NutritionService nutritionService;

    public NutritionHandler(NutritionService nutritionService) {
        this.nutritionService = nutritionService;
    }

    @Override
    @SuppressWarnings("unchecked")
    protected void process(HttpExchange exchange) throws Exception {
        if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
            sendJson(exchange, 405, "{\"error\":{\"message\":\"Method not allowed\"}}");
            return;
        }

        String body = readRequestBody(exchange);
        Map<String, Object> req = SimpleJson.parseObject(body);

        String title = String.valueOf(req.getOrDefault("title", "Dish"));
        int servings = 2;
        Object servObj = req.get("servings");
        if (servObj instanceof Number) {
            servings = ((Number) servObj).intValue();
        }

        List<Map<String, Object>> ingredients = new ArrayList<>();
        Object ingsObj = req.get("ingredients");
        if (ingsObj instanceof List<?> list) {
            for (Object item : list) {
                if (item instanceof Map<?, ?> m) {
                    ingredients.add((Map<String, Object>) m);
                } else if (item instanceof String s) {
                    Map<String, Object> simple = new LinkedHashMap<>();
                    simple.put("name", s);
                    ingredients.add(simple);
                }
            }
        }

        NutritionProfile profile = nutritionService.analyze(title, servings, ingredients);

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("success", true);
        res.put("recipe", title);
        res.put("calories", profile.calories());
        res.put("proteinGrams", profile.proteinGrams());
        res.put("carbsGrams", profile.carbsGrams());
        res.put("fatGrams", profile.fatGrams());
        res.put("fiberGrams", profile.fiberGrams());
        res.put("healthScore", profile.healthScore());
        res.put("macroRating", profile.macroBalanceRating());
        res.put("details", profile.details());

        sendJson(exchange, 200, SimpleJson.stringify(res));
    }
}

