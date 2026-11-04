# Mochi Kitchen - Java Analytics & Chef Engine Microservice

This module is the **Java-based backend microservice** for the Mochi Kitchen Full-Stack project.

It provides high-performance nutritional calculations, kitchen workload and prep-time estimation, and culinary insights to the Node.js API gateway and the React frontend.

---

## 🏗️ Architecture & OOP Design Patterns

This Java service is built following clean software engineering and Object-Oriented Programming (OOP) principles:

1. **Clean Layered Architecture**:
   - `model/`: Immutable Data Transfer Objects (DTOs) leveraging **Java Records** (`NutritionProfile`, `KitchenWorkload`, `ChefInsight`, `ServiceStatus`).
   - `service/`: **Strategy & Interface Pattern** (`NutritionService`, `WorkloadService`) with clean testable implementations (`NutritionServiceImpl`, `WorkloadServiceImpl`).
   - `handler/`: HTTP Controller layer inheriting from abstract `BaseHandler` to enforce uniform CORS, JSON headers, and error handling.
   - `util/`: Self-contained JSON serialization/deserialization utilities (`SimpleJson`).

2. **Key Capabilities**:
   - **Nutritional Analysis (`/api/java/nutrition`)**: Computes calories, protein, carbs, fat, fiber, health balance index (0–100), and macro ratios from recipe ingredients.
   - **Kitchen Workload & Prep Estimator (`/api/java/workload`)**: Parses instruction steps to extract cooking times, identifies required culinary equipment, and rates overall cooking difficulty.
   - **Chef Recommendations (`/api/java/insights`)**: Delivers flavor balancing tips, seasonal advice, and drink pairings.
   - **JVM Health & Telemetry (`/api/java/health`)**: Reports active uptime, memory utilization, and OpenJDK runtime environment details.

---

## 🚀 How to Run

### Option 1: Standalone Batch Scripts
- **Build**: Double-click `build.bat` or run:
  ```cmd
  build.bat
  ```
- **Run**: Double-click `run.bat` or run:
  ```cmd
  run.bat
  ```
  The Java microservice starts on `http://localhost:8080`.

### Option 2: From the Main Web Project (npm)
In the main `mochi-kitchen` directory:
- **Build Java**:
  ```bash
  npm run java:build
  ```
- **Run Java**:
  ```bash
  npm run java:start
  ```

### Option 3: Standard Maven (IntelliJ IDEA / Eclipse / VS Code)
Open this directory in your favorite Java IDE. The included `pom.xml` provides standard Maven configuration for Java 17/21/25.

