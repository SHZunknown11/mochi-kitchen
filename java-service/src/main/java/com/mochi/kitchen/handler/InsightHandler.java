package com.mochi.kitchen.handler;

import com.mochi.kitchen.model.ChefInsight;
import com.mochi.kitchen.service.ChefInsightService;
import com.mochi.kitchen.util.SimpleJson;
import com.sun.net.httpserver.HttpExchange;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Endpoint /api/java/insights providing culinary tips, flavor harmonies, and pairings.
 */
public class InsightHandler extends BaseHandler {

    private final ChefInsightService insightService;

    public InsightHandler(ChefInsightService insightService) {
        this.insightService = insightService;
    }

    @Override
    protected void process(HttpExchange exchange) throws Exception {
        String title = "Daily Special";
        String cuisine = "Japanese";
        String category = "Main";

        if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
            String body = readRequestBody(exchange);
            Map<String, Object> req = SimpleJson.parseObject(body);
            if (req.containsKey("title")) title = String.valueOf(req.get("title"));
            if (req.containsKey("area")) cuisine = String.valueOf(req.get("area"));
            if (req.containsKey("category")) category = String.valueOf(req.get("category"));
        }

        ChefInsight insight = insightService.getInsight(title, cuisine, category);

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("success", true);
        res.put("dish", insight.dishName());
        res.put("profile", insight.culinaryProfile());
        res.put("flavorHarmonies", insight.flavorHarmonies());
        res.put("proTips", insight.proTips());
        res.put("pairingAdvice", insight.wineOrTeaPairing());
        res.put("seasonality", insight.seasonality());

        sendJson(exchange, 200, SimpleJson.stringify(res));
    }
}

