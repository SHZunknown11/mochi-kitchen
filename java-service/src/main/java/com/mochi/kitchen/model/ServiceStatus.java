package com.mochi.kitchen.model;

/**
 * Health and telemetry status for the Java service.
 */
public record ServiceStatus(
    String status,
    String serviceName,
    String javaVersion,
    String jvmVendor,
    long uptimeSeconds,
    long usedMemoryMb,
    long maxMemoryMb
) {}

