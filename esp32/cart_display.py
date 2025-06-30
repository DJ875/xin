import network
import urequests
import json
from machine import Pin, I2C, SPI
import ssd1306
from time import sleep

# 配置WiFi连接
WIFI_SSID = "您的WiFi名称"
WIFI_PASSWORD = "您的WiFi密码"

# Netlify配置
# 例如：如果您的网站是 my-shop.netlify.app，就填写 "my-shop"
NETLIFY_SITE_NAME = "您的Netlify站点名称"
API_URL = f"https://{NETLIFY_SITE_NAME}.netlify.app/.netlify/functions/api/cart"

# 配置OLED显示屏
# 使用I2C接口
i2c = I2C(scl=Pin(22), sda=Pin(21))
oled = ssd1306.SSD1306_I2C(128, 64, i2c)

def connect_wifi():
    """连接WiFi网络"""
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    if not wlan.isconnected():
        print('连接到WiFi...')
        wlan.connect(WIFI_SSID, WIFI_PASSWORD)
        while not wlan.isconnected():
            pass
    print('WiFi已连接')
    print('IP地址:', wlan.ifconfig()[0])
    print('Netlify URL:', API_URL)  # 打印完整的API URL以便确认

def get_cart_data():
    """从API获取购物车数据"""
    try:
        response = urequests.get(API_URL)
        data = json.loads(response.text)
        response.close()
        return data
    except Exception as e:
        print('获取购物车数据失败:', e)
        return None

def display_cart_info(data):
    """在OLED显示屏上显示购物车信息"""
    try:
        oled.fill(0)  # 清空显示
        
        # 显示商品数量
        oled.text("Items: {}".format(data['itemCount']), 0, 0)
        
        # 显示总金额
        oled.text("Total: ￥{:.2f}".format(data['total']), 0, 20)
        
        # 显示更新时间
        oled.text("Updated", 0, 40)
        
        oled.show()
    except Exception as e:
        print('显示数据失败:', e)

def main():
    """主函数"""
    # 连接WiFi
    connect_wifi()
    
    while True:
        try:
            # 获取购物车数据
            cart_data = get_cart_data()
            if cart_data:
                # 显示数据
                display_cart_info(cart_data)
            
            # 每5秒更新一次
            sleep(5)
            
        except Exception as e:
            print('运行错误:', e)
            sleep(5)

if __name__ == '__main__':
    main() 