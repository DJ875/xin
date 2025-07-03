package com.big.model;

import com.alibaba.fastjson.JSONObject;
import com.alibaba.fastjson.JSONArray;
import okhttp3.*;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLSocketFactory;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.security.cert.X509Certificate;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.concurrent.TimeUnit;

public class BigModelNew extends WebSocketListener {
    // 使用您提供的认证信息
    private static final String API_KEY = "eHWPqahWJSRJIKhkAgTz";
    private static final String API_SECRET = "WLWIxlNqEWjJqvipjNgC";
    private static final String APP_ID = "885c0f82";
    
    // 使用您提供的WebSocket接口地址
    private static final String API_URL = "wss://spark-api.xf-yun.com/v1/x1";
    private static final String WS_HOST = "spark-api.xf-yun.com";
    
    public static String totalAnswer = ""; // 大模型的答案汇总
    public static String NewQuestion = ""; // 用于存储要提问的问题

    // 回调接口用于通知答案更新
    public interface AnswerCallback {
        void onAnswerUpdated(String answer);
    }
    
    private AnswerCallback callback;

    public BigModelNew() {
        // 默认构造函数
    }
    
    public BigModelNew(AnswerCallback callback) {
        this.callback = callback;
    }

    private static OkHttpClient createOkHttpClient() {
        try {
            TrustManager[] trustAllCerts = new TrustManager[]{
                new X509TrustManager() {
                    @Override
                    public void checkClientTrusted(X509Certificate[] chain, String authType) {
                    }

                    @Override
                    public void checkServerTrusted(X509Certificate[] chain, String authType) {
                    }

                    @Override
                    public X509Certificate[] getAcceptedIssuers() {
                        return new X509Certificate[0];
                    }
                }
            };

            SSLContext sslContext = SSLContext.getInstance("TLS");
            sslContext.init(null, trustAllCerts, new SecureRandom());
            SSLSocketFactory sslSocketFactory = sslContext.getSocketFactory();

            return new OkHttpClient.Builder()
                    .readTimeout(60, TimeUnit.SECONDS)
                    .writeTimeout(60, TimeUnit.SECONDS)
                    .connectTimeout(60, TimeUnit.SECONDS)
                    .sslSocketFactory(sslSocketFactory, (X509TrustManager) trustAllCerts[0])
                    .hostnameVerifier((hostname, session) -> true)
                    .build();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    public void getAnswer(String question) {
        try {
            OkHttpClient client = createOkHttpClient();
            String date = getGMTDate();
            String signature = getSignature(date);
            
            // 构造原始认证字符串
            String rawAuthorization = String.format("api_key=\"%s\", algorithm=\"%s\", headers=\"%s\", signature=\"%s\"",
                    API_KEY, "hmac-sha256", "host date request-line", signature);
            
            // Base64编码认证字符串
            String authorization = Base64.getEncoder().encodeToString(rawAuthorization.getBytes(StandardCharsets.UTF_8));
            
            // 构造URL
            String wsUrl = String.format("%s?authorization=%s&date=%s&host=%s",
                    API_URL,
                    URLEncoder.encode(authorization, "UTF-8"),
                    URLEncoder.encode(date, "UTF-8"),
                    URLEncoder.encode(WS_HOST, "UTF-8"));

            Request request = new Request.Builder()
                    .url(wsUrl)
                    .addHeader("Host", WS_HOST)
                    .addHeader("Date", date)
                    .build();

            System.out.println("Connecting to WebSocket URL: " + wsUrl);
            System.out.println("Date: " + date);
            System.out.println("Raw Authorization: " + rawAuthorization);
            System.out.println("Encoded Authorization: " + authorization);
            System.out.println("Signature: " + signature);
            
            totalAnswer = ""; // 重置答案
            NewQuestion = question; // 设置新问题
            WebSocket webSocket = client.newWebSocket(request, this);

        } catch (Exception e) {
            e.printStackTrace();
            totalAnswer = "请求失败：" + e.getMessage();
            notifyCallback();
        }
    }

    // 获取GMT格式时间
    private String getGMTDate() {
        SimpleDateFormat format = new SimpleDateFormat("EEE, dd MMM yyyy HH:mm:ss z", Locale.US);
        format.setTimeZone(TimeZone.getTimeZone("GMT"));
        return format.format(new Date());
    }

    // 生成签名
    private String getSignature(String date) throws Exception {
        // 确保路径与接口地址匹配
        String path = "/v1/x1";
        String signatureOrigin = "host: " + WS_HOST + "\n" +
                                "date: " + date + "\n" +
                                "GET " + path + " HTTP/1.1";

        System.out.println("Signature Origin:\n" + signatureOrigin);
        
        Mac mac = Mac.getInstance("HmacSHA256");
        SecretKeySpec spec = new SecretKeySpec(API_SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
        mac.init(spec);
        byte[] hexDigits = mac.doFinal(signatureOrigin.getBytes(StandardCharsets.UTF_8));
        return Base64.getEncoder().encodeToString(hexDigits);
    }

    // 通知回调
    private void notifyCallback() {
        if (callback != null) {
            callback.onAnswerUpdated(totalAnswer);
        }
    }

    @Override
    public void onOpen(WebSocket webSocket, Response response) {
        try {
            JSONObject requestJson = new JSONObject();
            
            // 添加header
            JSONObject header = new JSONObject();
            header.put("app_id", APP_ID);
            header.put("uid", UUID.randomUUID().toString().replace("-", "").substring(0, 32));
            requestJson.put("header", header);
            
            // 添加parameter
            JSONObject parameter = new JSONObject();
            JSONObject chat = new JSONObject();
            chat.put("domain", "x1");
            chat.put("temperature", 0.7);
            chat.put("max_tokens", 2048);
            parameter.put("chat", chat);
            requestJson.put("parameter", parameter);
            
            // 添加payload
            JSONObject payload = new JSONObject();
            JSONObject message = new JSONObject();
            
            // 构造消息数组
            List<Map<String, String>> textList = new ArrayList<>();
            Map<String, String> textMap = new HashMap<>();
            textMap.put("role", "user");
            textMap.put("content", NewQuestion);
            textList.add(textMap);
            
            message.put("text", textList);
            payload.put("message", message);
            requestJson.put("payload", payload);
            
            System.out.println("Sending request: " + requestJson.toString());
            webSocket.send(requestJson.toString());
        } catch (Exception e) {
            e.printStackTrace();
            totalAnswer = "请求发送失败：" + e.getMessage();
            notifyCallback();
            webSocket.close(1000, "");
        }
    }

    @Override
    public void onMessage(WebSocket webSocket, String text) {
        try {
            System.out.println("Received message: " + text);
            JSONObject responseJson = JSONObject.parseObject(text);
            
            // 检查错误信息
            if (responseJson.containsKey("code") && responseJson.getIntValue("code") != 0) {
                String errorMsg = responseJson.getString("message");
                totalAnswer = "API错误: " + errorMsg + " (错误码: " + responseJson.getIntValue("code") + ")";
                notifyCallback();
                webSocket.close(1000, "");
                return;
            }
            
            JSONObject payload = responseJson.getJSONObject("payload");
            if (payload != null) {
                JSONObject choices = payload.getJSONObject("choices");
                if (choices != null) {
                    String status = choices.getString("status");
                    JSONArray textArray = choices.getJSONArray("text");
                    
                    if (textArray != null && !textArray.isEmpty()) {
                        JSONObject textObj = textArray.getJSONObject(0);
                        String content = textObj.getString("content");
                        if (content != null) {
                            totalAnswer = content;
                            notifyCallback();
                        }
                    }
                    
                    if (status != null && "2".equals(status)) {
                        // 会话结束
                        webSocket.close(1000, "Completed");
                        return;
                    }
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
            totalAnswer = "响应解析失败：" + e.getMessage();
            notifyCallback();
            webSocket.close(1000, "");
        }
    }

    @Override
    public void onFailure(WebSocket webSocket, Throwable t, Response response) {
        t.printStackTrace();
        totalAnswer = "连接失败：" + t.getMessage();
        
        if (response != null) {
            try {
                totalAnswer += "\n响应码：" + response.code();
                totalAnswer += "\n响应信息：" + response.message();
                if (response.body() != null) {
                    totalAnswer += "\n响应体：" + response.body().string();
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        } else {
            totalAnswer += "\n无响应信息";
        }
        
        notifyCallback();
        webSocket.close(1000, "");
    }

    @Override
    public void onClosed(WebSocket webSocket, int code, String reason) {
        System.out.println("WebSocket closed: " + code + " - " + reason);
        notifyCallback();
    }
}