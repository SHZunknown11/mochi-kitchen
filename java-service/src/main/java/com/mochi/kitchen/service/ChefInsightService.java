package com.mochi.kitchen.service;

import com.mochi.kitchen.model.ChefInsight;
import java.util.*;

/**
 * Service generating culinary recommendations, flavor harmonies, and pairings.
 */
public class ChefInsightService {

    public ChefInsight getInsight(String title, String cuisine, String category) {
        String name = (title != null && !title.isBlank()) ? title : "Featured Dish";
        String area = (cuisine != null && !cuisine.isBlank()) ? cuisine : "East Asian";
        String cat = (category != null && !category.isBlank()) ? category : "Main";

        List<String> tips = new ArrayList<>();
        tips.add("Season in layers: salt early to season throughout, and finish with fresh herbs or sesame oil right before serving.");
        tips.add("Balance umami with a drop of acid (rice vinegar or citrus) to brighten savory notes.");
        tips.add("Garnish with toasted sesame seeds or scallion greens for contrasting texture.");

        String pairing = "Pair with hot roasted Genmaicha green tea or chilled sparkling yuzu water.";
        String flavor = "Savory Umami · Gentle Sweetness · Toasted Sesame notes";
        String season = "All Seasons · Comfort Dining";

        if ("Soup".equalsIgnoreCase(cat) || "Noodles".equalsIgnoreCase(cat)) {
            pairing = "Pairs wonderfully with warm Hojicha tea or crisp pickled radish (danmuji).";
            flavor = "Deep Broth Umami · Warming Spice · Silky Aromatics";
            season = "Autumn & Winter Comfort";
        }

        return new ChefInsight(
            name,
            area + " " + cat,
            flavor,
            tips,
            pairing,
            season
        );
    }
}

