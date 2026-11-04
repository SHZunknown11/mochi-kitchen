package com.mochi.kitchen.handler;

import com.mochi.kitchen.model.KitchenWorkload;
import com.mochi.kitchen.service.WorkloadService;
import com.mochi.kitchen.util.SimpleJson;
import com.sun.net.httpserver.HttpExchange;
import java.util.*;

/**
 * Endpoint /api/java/workload evaluating step difficulty, timing, and equipment.
 */
public class WorkloadHandler extends BaseHandler {

    private final WorkloadService workloadService;

    public WorkloadHandler(WorkloadService workloadService) {
        this.workloadService = workloadService;
    }

    @Override
    protected void process(HttpExchange exchange) throws Exception {
        if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
            sendJson(exchange, 405, "{\"error\":{\"message\":\"Method not allowed\"}}");
            return;
        }

        String body = readRequestBody(exchange);
        Map<String, Object> req = SimpleJson.parseObject(body);

        List<String> steps = new ArrayList<>();
        Object stepsObj = req.get("steps");
        if (stepsObj instanceof List<?> list) {
            for (Object item : list) {
                if (item != null) steps.add(String.valueOf(item));
            }
        }

        int ingredientCount = 6;
        Object ingsObj = req.get("ingredientCount");
        if (ingsObj instanceof Number) {
            ingredientCount = ((Number) ingsObj).intValue();
        }

        KitchenWorkload workload = workloadService.calculate(steps, ingredientCount);

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("success", true);
        res.put("estimatedPrepMinutes", workload.estimatedPrepMinutes());
        res.put("estimatedCookMinutes", workload.estimatedCookMinutes());
        res.put("totalMinutes", workload.totalMinutes());
        res.put("difficultyLevel", workload.difficultyLevel());
        res.put("difficultyStars", workload.difficultyStars());
        res.put("equipmentRequired", workload.equipmentRequired());
        res.put("primaryTechniques", workload.primaryCookingTechniques());
        res.put("chefWorkloadTip", workload.chefWorkloadTip());

        sendJson(exchange, 200, SimpleJson.stringify(res));
    }
}

