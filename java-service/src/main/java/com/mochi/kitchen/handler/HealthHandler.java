package com.mochi.kitchen.handler;

import com.mochi.kitchen.model.ServiceStatus;
import com.mochi.kitchen.util.SimpleJson;
import com.sun.net.httpserver.HttpExchange;
import java.lang.management.ManagementFactory;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Endpoint /api/java/health returning JVM status and health telemetry.
 */
public class HealthHandler extends BaseHandler {

    private final long startTime = System.currentTimeMillis();

    @Override
    protected void process(HttpExchange exchange) throws Exception {
        long uptime = (System.currentTimeMillis() - startTime) / 1000;
        Runtime rt = Runtime.getRuntime();
        long usedMem = (rt.totalMemory() - rt.freeMemory()) / (1024 * 1024);
        long maxMem = rt.maxMemory() / (1024 * 1024);

        ServiceStatus status = new ServiceStatus(
            "UP",
            "Mochi Kitchen Java Core Engine",
            System.getProperty("java.version"),
            System.getProperty("java.vendor"),
            uptime,
            usedMem,
            maxMem
        );

        Map<String, Object> map = new LinkedHashMap<>();
        map.put("status", status.status());
        map.put("service", status.serviceName());
        map.put("javaVersion", status.javaVersion());
        map.put("jvmVendor", status.jvmVendor());
        map.put("uptimeSeconds", status.uptimeSeconds());
        map.put("usedMemoryMb", status.usedMemoryMb());
        map.put("maxMemoryMb", status.maxMemoryMb());
        map.put("architecture", "Full Stack Microservice (Node.js Gateway + Java 25 Engine)");

        sendJson(exchange, 200, SimpleJson.stringify(map));
    }
}

