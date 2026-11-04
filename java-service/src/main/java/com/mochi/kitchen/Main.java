package com.mochi.kitchen;

import com.mochi.kitchen.handler.*;
import com.mochi.kitchen.service.*;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.util.concurrent.Executors;

/**
 * Mochi Kitchen - Java Analytics &amp; Chef Insights Microservice Entry Point.
 */
public class Main {

    public static final int DEFAULT_PORT = 8080;

    public static void main(String[] args) throws IOException {
        int port = DEFAULT_PORT;
        if (args.length > 0) {
            try {
                port = Integer.parseInt(args[0]);
            } catch (NumberFormatException ignored) {}
        }

        // Initialize Services (OOP Dependency Injection)
        NutritionService nutritionService = new NutritionServiceImpl();
        WorkloadService workloadService = new WorkloadServiceImpl();
        ChefInsightService insightService = new ChefInsightService();

        // Create embedded HTTP Server
        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);

        // Register REST endpoints
        server.createContext("/api/java/health", new HealthHandler());
        server.createContext("/api/java/nutrition", new NutritionHandler(nutritionService));
        server.createContext("/api/java/workload", new WorkloadHandler(workloadService));
        server.createContext("/api/java/insights", new InsightHandler(insightService));

        // Use thread pool for multi-threaded request processing
        server.setExecutor(Executors.newFixedThreadPool(8));
        server.start();

        System.out.println("==========================================================");
        System.out.println("   MOCHI KITCHEN - JAVA ANALYTICS MICROSERVICE ONLINE     ");
        System.out.println("==========================================================");
        System.out.println(" Port          : http://localhost:" + port);
        System.out.println(" Java Version  : " + System.getProperty("java.version") + " (" + System.getProperty("java.vendor") + ")");
        System.out.println(" Architecture  : Full Stack Java & Node.js Microservices");
        System.out.println(" Endpoints     : /api/java/health");
        System.out.println("                 /api/java/nutrition");
        System.out.println("                 /api/java/workload");
        System.out.println("                 /api/java/insights");
        System.out.println(" Status        : Ready to accept requests.");
        System.out.println("==========================================================");

        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            System.out.println("\nStopping Mochi Kitchen Java Engine...");
            server.stop(1);
            System.out.println("Mochi Kitchen Java Engine stopped gracefully.");
        }));
    }
}

