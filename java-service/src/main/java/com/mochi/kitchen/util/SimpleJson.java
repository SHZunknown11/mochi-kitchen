package com.mochi.kitchen.util;

import java.util.*;

/**
 * Lightweight pure-Java JSON serializer and parser.
 * Requires zero external dependencies.
 */
public class SimpleJson {

    public static String stringify(Object obj) {
        if (obj == null) return "null";
        if (obj instanceof String) {
            return "\"" + escape((String) obj) + "\"";
        }
        if (obj instanceof Number || obj instanceof Boolean) {
            return String.valueOf(obj);
        }
        if (obj instanceof Map<?, ?> map) {
            StringBuilder sb = new StringBuilder("{");
            boolean first = true;
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                if (!first) sb.append(",");
                first = false;
                sb.append("\"").append(escape(String.valueOf(entry.getKey()))).append("\":");
                sb.append(stringify(entry.getValue()));
            }
            sb.append("}");
            return sb.toString();
        }
        if (obj instanceof Collection<?> coll) {
            StringBuilder sb = new StringBuilder("[");
            boolean first = true;
            for (Object item : coll) {
                if (!first) sb.append(",");
                first = false;
                sb.append(stringify(item));
            }
            sb.append("]");
            return sb.toString();
        }
        if (obj.getClass().isArray()) {
            StringBuilder sb = new StringBuilder("[");
            int len = java.lang.reflect.Array.getLength(obj);
            for (int i = 0; i < len; i++) {
                if (i > 0) sb.append(",");
                sb.append(stringify(java.lang.reflect.Array.get(obj, i)));
            }
            sb.append("]");
            return sb.toString();
        }
        return "\"" + escape(obj.toString()) + "\"";
    }

    private static String escape(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\b", "\\b")
                .replace("\f", "\\f")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t");
    }

    @SuppressWarnings("unchecked")
    public static Map<String, Object> parseObject(String json) {
        if (json == null) return Collections.emptyMap();
        json = json.trim();
        if (json.isEmpty() || !json.startsWith("{") || !json.endsWith("}")) {
            return Collections.emptyMap();
        }
        Object parsed = new Parser(json).parseValue();
        if (parsed instanceof Map) {
            return (Map<String, Object>) parsed;
        }
        return Collections.emptyMap();
    }

    private static class Parser {
        private final String src;
        private int pos = 0;

        Parser(String src) {
            this.src = src;
        }

        private void skipWhitespace() {
            while (pos < src.length() && Character.isWhitespace(src.charAt(pos))) {
                pos++;
            }
        }

        private char peek() {
            skipWhitespace();
            return pos < src.length() ? src.charAt(pos) : '\0';
        }

        private char next() {
            skipWhitespace();
            return pos < src.length() ? src.charAt(pos++) : '\0';
        }

        Object parseValue() {
            char c = peek();
            if (c == '{') return parseObj();
            if (c == '[') return parseArr();
            if (c == '"' || c == '\'') return parseStr();
            if (c == 't' || c == 'f') return parseBool();
            if (c == 'n') return parseNull();
            if (Character.isDigit(c) || c == '-') return parseNum();
            return null;
        }

        private Map<String, Object> parseObj() {
            Map<String, Object> map = new LinkedHashMap<>();
            next(); // consume '{'
            while (pos < src.length()) {
                char c = peek();
                if (c == '}') {
                    next();
                    break;
                }
                String key = parseStr();
                skipWhitespace();
                if (peek() == ':') next();
                Object val = parseValue();
                map.put(key, val);
                skipWhitespace();
                if (peek() == ',') next();
            }
            return map;
        }

        private List<Object> parseArr() {
            List<Object> list = new ArrayList<>();
            next(); // consume '['
            while (pos < src.length()) {
                char c = peek();
                if (c == ']') {
                    next();
                    break;
                }
                list.add(parseValue());
                skipWhitespace();
                if (peek() == ',') next();
            }
            return list;
        }

        private String parseStr() {
            char quote = next();
            StringBuilder sb = new StringBuilder();
            while (pos < src.length()) {
                char c = src.charAt(pos++);
                if (c == quote) break;
                if (c == '\\' && pos < src.length()) {
                    char esc = src.charAt(pos++);
                    switch (esc) {
                        case 'n': sb.append('\n'); break;
                        case 'r': sb.append('\r'); break;
                        case 't': sb.append('\t'); break;
                        case 'b': sb.append('\b'); break;
                        case 'f': sb.append('\f'); break;
                        case '"': sb.append('"'); break;
                        case '\\': sb.append('\\'); break;
                        default: sb.append(esc);
                    }
                } else {
                    sb.append(c);
                }
            }
            return sb.toString();
        }

        private Boolean parseBool() {
            if (src.startsWith("true", pos)) { pos += 4; return true; }
            if (src.startsWith("false", pos)) { pos += 5; return false; }
            return false;
        }

        private Object parseNull() {
            if (src.startsWith("null", pos)) { pos += 4; return null; }
            return null;
        }

        private Number parseNum() {
            int start = pos;
            if (src.charAt(pos) == '-') pos++;
            while (pos < src.length() && (Character.isDigit(src.charAt(pos)) || src.charAt(pos) == '.')) {
                pos++;
            }
            String s = src.substring(start, pos);
            if (s.contains(".")) {
                try { return Double.parseDouble(s); } catch (Exception e) { return 0.0; }
            }
            try { return Long.parseLong(s); } catch (Exception e) { return 0L; }
        }
    }
}

