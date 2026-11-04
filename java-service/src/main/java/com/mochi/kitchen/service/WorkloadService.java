package com.mochi.kitchen.service;

import com.mochi.kitchen.model.KitchenWorkload;
import java.util.List;

/**
 * Strategy interface for calculating kitchen preparation workload and difficulty.
 */
public interface WorkloadService {
    KitchenWorkload calculate(List<String> steps, int ingredientCount);
}

