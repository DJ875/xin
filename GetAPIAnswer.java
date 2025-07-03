package com.big.model;

import javax.swing.*;
import java.awt.*;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;

public class GetAPIAnswer {
    public static void main(String[] args) {
        JFrame frame = new JFrame("智能助手小天");
        frame.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        frame.setSize(600, 400);
        frame.setLayout(new BorderLayout());

        JTextArea chatArea = new JTextArea();
        chatArea.setEditable(false);
        JScrollPane scrollPane = new JScrollPane(chatArea);
        frame.add(scrollPane, BorderLayout.CENTER);

        JPanel inputPanel = new JPanel(new BorderLayout());
        JTextField inputField = new JTextField();
        JButton sendButton = new JButton("发送");

        inputPanel.add(inputField, BorderLayout.CENTER);
        inputPanel.add(sendButton, BorderLayout.EAST);
        frame.add(inputPanel, BorderLayout.SOUTH);

        sendButton.addActionListener(new ActionListener() {
            @Override
            public void actionPerformed(ActionEvent e) {
                String question = inputField.getText();
                if (!question.trim().isEmpty()) {
                    chatArea.append("我：" + question + "\n");
                    inputField.setText("");
                    try {
                        // 创建带回调的实例
                        BigModelNew instance = new BigModelNew(new BigModelNew.AnswerCallback() {
                            @Override
                            public void onAnswerUpdated(String answer) {
                                // 使用SwingUtilities确保在EDT线程中更新UI
                                SwingUtilities.invokeLater(() -> {
                                    chatArea.append("小天：" + answer + "\n");
                                });
                            }
                        });
                        
                        // 发送问题
                        instance.getAnswer(question);
                    } catch (Exception ex) {
                        chatArea.append("发生错误：" + ex.getMessage() + "\n");
                    }
                }
            }
        });

        frame.setVisible(true);
    }
}