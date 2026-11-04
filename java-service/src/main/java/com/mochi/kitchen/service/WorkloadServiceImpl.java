package com.mochi.kitchen.service;

import com.mochi.kitchen.model.KitchenWorkload;
import java.util.*;
import java.util.regex.*;

/**
 * Evaluates recipe complexity, estimated cooking time, required tools, and techniques.
 */
public class WorkloadServiceImpl implements WorkloadService {

    @Override
    public KitchenWorkload calculate(List<String> steps, int ingredientCount) {
        if (steps == null) steps = Collections.emptyList();

        int prepTime = Math.max(5, ingredientCount * 2);
        int cookTime = 0;
        Set<String> tools = new LinkedHashSet<>();
        Set<String> techniques = new LinkedHashSet<>();

        Pattern timePattern = Pattern.compile("(\\d+)\\s*(?:minute|min)", Pattern.CASE_INSENSITIVE);

        for (String step : steps) {
            String lower = step.toLowerCase();

            // Extract minutes from text
            Matcher matcher = timePattern.matcher(lower);
            while (matcher.find()) {
                try {
                    cookTime += Integer.parseInt(matcher.group(1));
                } catch (Exception ignored) {}
            }

            // Identify tools
            if (lower.contains("pan") || lower.contains("skillet") || lower.contains("fry")) tools.add("Skillet / Pan");
            if (lower.contains("pot") || lower.contains("boil") || lower.contains("simmer")) tools.add("Cooking Pot");
            if (lower.contains("wok")) tools.add("Wok");
            if (lower.contains("knife") || lower.contains("slice") || lower.contains("chop") || lower.contains("julienne")) tools.add("Chef's Knife & Board");
            if (lower.contains("oven") || lower.contains("bake") || lower.contains("roast")) tools.add("Oven / Baking Tray");
            if (lower.contains("whisk") || lower.contains("beat")) tools.add("Whisk / Mixing Bowl");

            // Identify techniques
            if (lower.contains("simmer")) techniques.add("Gentle Simmering");
            if (lower.contains("stir-fry") || lower.contains("sauté")) techniques.add("Stir-frying / Sauté");
            if (lower.contains("boil")) techniques.add("Boiling");
            if (lower.contains("marinate")) techniques.add("Marinating");
            if (lower.contains("steam")) techniques.add("Steaming");
            if (lower.contains("blanch")) techniques.add("Blanching");
        }

        if (cookTime == 0) cookTime = Math.max(10, steps.size() * 5);
        if (tools.isEmpty()) tools.add("Basic Pan & Knife");
        if (techniques.isEmpty()) techniques.add("Assembly & Cook");

        int totalTime = prepTime + cookTime;

        // Difficulty heuristic
        String difficulty;
        int stars;
        if (totalTime <= 20 && steps.size() <= 4) {
            difficulty = "Easy / Quick Weeknight";
            stars = 1;
        } else if (totalTime <= 40 && steps.size() <= 6) {
            difficulty = "Moderate / Home Cook Friendly";
            stars = 2;
        } else {
            difficulty = "Chef Level / Multi-Stage";
            stars = 3;
        }

        String chefTip = generateChefTip(techniques, tools);

        return new KitchenWorkload(
            prepTime,
            cookTime,
            totalTime,
            difficulty,
            stars,
            new ArrayList<>(tools),
            new ArrayList<>(techniques),
            chefTip
        );
    }

    private String generateChefTip(Set<String> techniques, Set<String> tools) {
        if (techniques.contains("Stir-frying / Sauté")) {
            return "Chef Pro Tip: Get your pan smoking hot before adding aromatics to lock in maximum wok-hei aroma!";
        }
        if (techniques.contains("Gentle Simmering")) {
            return "Chef Pro Tip: Keep the flame on low so flavors meld without breaking delicate ingredients.";
        }
        if (techniques.contains("Marinating")) {
            return "Chef Pro Tip: Pat ingredients dry before frying so they brown nicely instead of steaming.";
        }
        return "Chef Pro Tip: Complete all mise en place (chopping & measuring) before turning on the stove!";
    }
}

