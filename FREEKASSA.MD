SCI
1. Введение
1.1. Что такое SCI?
SCI (Shop Cart Interface) — это программный интерфейс, который позволяет любому мерчанту автоматически принимать платежи в режиме онлайн.

страницы приема платежей

Демонстрация - https://pay.fk.money/?m=312&oa=1000&i=&currency=RUB&em=&phone=&o=123&pay=PAY&s=e723c585cb601241c5bb5727efa16b08

1.2. Настройка учетной записи
Для начала работы необходимо заполнить следующую форму в личном кабинете на странице [настройки](https://merchant.freekassa.net/settings

Название
Примечание
Название сайта	Отображается на странице оплаты
URL сайта	URL Вашего сайта
Секретное слово	Секретное слово для формирования подписи для формы оплаты
Секретное слово 2	Секретное слово для формирования подписи для проверки данных (которые отправляются на Ваш Result Url) после оплаты
URL оповещения	Страница Вашего сайта, на который будут отправлены данные с информацией о платеже
Метод оповещения	Здесь и ниже - способ передачи данных на Ваш сайт (GET или POST)
URL возврата в случае успеха	На эту страницу будет перенаправлен покупатель в случае успешной оплаты
URL возврата в случае неудачи	На эту страницу будет перенаправлен покупатель, если при оплате возникла какая-либо ошибка
Кто платит комиссию	Кто платит комиссию при осуществлении платежей
Подтверждение платежа	Если Вы хотите быть уверены, что подтверждение на URL оповещения дошло успешно и обработано верно, добавьте в скрипт URL оповещения вывод слова YES . После этого наш сервер будет передавать информацию о платеже на ваш URL оповещения до тех пор, пока не получит ответ YES.
Тестовый режим	После включения тестового режима, будет доступна оплата тестовым способом, при этом реального зачисления произведено не будет - будьте внимательны!
1.3. Настройка формы оплаты
Форма оплаты содержит все необходимые данные для оплаты заказа. Передается методом GET на адрес https://pay.fk.money/

Параметр
Примечание
ОБЯЗАТЕЛЬНЫЕ	
m	ID Вашего магазина
oa	Сумма платежа
currency	Валюта платежа (RUB,USD,EUR,UAH,KZT)
o	Номер заказа (также это может быть название товара или логин пользователя, для зачисления средств)
s	Подпись методика формирования подписи в платежной форме
ДОПОЛНИТЕЛЬНЫЕ	
i	Предлагаемая валюта платежа список валют. Плательщик сможет изменить ее в процессе оплаты.
phone	Телефон плательщика
em	Email плательщика
lang	Язык интерфейса оплаты (en/ru)
us_key	Так же Вы можете передавать свои параметры, которые наш сервер вернет на Ваш URL оповещения. Ключи параметров должны начинаться с us_ и содержать только латинские символы и цифры. Значения параметров могут содержать только латинские буквы, цифры и символы '-', '_'. Например:
<input type="text" name="us_name" value="ivanov"> <input type="text" name="us_login" value="ivanov1971">
1.4. Оповещение о платеже
После успешной оплаты, на Ваш URL оповещения будут отправлены следующие данные (в формате form-data)

Параметр
Примечание
MERCHANT_ID	ID Вашего магазина
AMOUNT	Сумма платежа
intid	Номер операции Free-Kassa
MERCHANT_ORDER_ID	Ваш номер заказа
P_EMAIL	Email плательщика
P_PHONE	Телефон плательщика (если указан)
CUR_ID	ID электронной валюты, который был оплачен заказ список валют
SIGN	Подпись запроса методика формирования подписи в данных оповещения
us_key	Дополнительные параметры с префиксом us_, переданные в форму оплаты
payer_account	Номер счета/карты плательщика
commission	Сумма комиссии в валюте платежа
Пример уведомления

  MERCHANT_ID=123&AMOUNT=100&intid=123456&MERCHANT_ORDER_ID=test_order&P_EMAIL=test_user@test_site.ru&P_PHONE=71231231212&CUR_ID=4&payer_account=123456xxxxxx1234&us_field1=123&us_field2=321&SIGN=68GH247bb77e0ab49f6e429b86bc3e2f
Подтверждение заявки
Если Вы хотите быть уверены, что подтверждение на URL оповещения дошло успешно и обработано верно, добавьте в скрипт URL оповещения вывод слова YES и обратитесь в техподдержку для включения функции проверки.
После этого наш сервер будет передавать информацию о платеже на ваш URL оповещения до тех пор, пока не получит ответ YES.

Проверка IP
Рекомендуем так же проверять IP сервера отправляющего Вам информацию, наши IP - 168.119.157.136, 168.119.60.227, 178.154.197.79, 51.250.54.238

Пример функции на PHP:

  function getIP() {
    if(isset($_SERVER['HTTP_X_REAL_IP'])) return $_SERVER['HTTP_X_REAL_IP'];
    return $_SERVER['REMOTE_ADDR'];
  }

  if (!in_array(getIP(), array('168.119.157.136', '168.119.60.227',  '178.154.197.79', '51.250.54.238'))) die("hacking attempt!");
Пример обработчика платежа:

  $merchant_id = '177';
  $merchant_secret = 'supersecret';

  function getIP() {
    if(isset($_SERVER['HTTP_X_REAL_IP'])) return $_SERVER['HTTP_X_REAL_IP'];
    return $_SERVER['REMOTE_ADDR'];
  }

  if (!in_array(getIP(), array('168.119.157.136', '168.119.60.227', '178.154.197.79', '51.250.54.238'))) die("hacking attempt!");

  $sign = md5($merchant_id.':'.$_REQUEST['AMOUNT'].':'.$merchant_secret.':'.$_REQUEST['MERCHANT_ORDER_ID']);

  if ($sign != $_REQUEST['SIGN']) die('wrong sign');

  //Так же, рекомендуется добавить проверку на сумму платежа и не была ли эта заявка уже оплачена или отменена

  //Оплата прошла успешно, можно проводить операцию.

  die('YES');
1.5. Формирование подписи в платежной форме
Подпись для платежной формы формируется путем нахождения MD5-хеша от строки "ID Вашего магазина:Сумма платежа:Секретное слово:Валюта платежа:Номер заказа", пример на PHP:

  md5('7012:100.11:secret:RUB:154')
Пример платежной формы:

  <?php
    $merchant_id = '7012';
    $secret_word = 'secret';
    $order_id = '154';
    $order_amount = '100.11';
    $currency = 'RUB';
    $sign = md5($merchant_id.':'.$order_amount.':'.$secret_word.':'.$currency.':'.$order_id);
  ?>

  <form method='get' action='https://pay.fk.money/'>
    <input type='hidden' name='m' value='<?php=$merchant_id?>'>
    <input type='hidden' name='oa' value='<?php=$order_amount?>'>
    <input type='hidden' name='o' value='<?php=$order_id?>'>
    <input type='hidden' name='s' value='<?php=$sign?>'>
    <input type='hidden' name='currency' value='<?php=$currency?>'>
    <input type='hidden' name='i' value='1'>
    <input type='hidden' name='lang' value='ru'>
    <input type='hidden' name='us_login' value='<?php=$user['login']?>'>
    <input type='submit' name='pay' value='Оплатить'>
  </form>
1.7. Формирование подписи в скрипте оповещения
Подпись для скрипта оповещения формируется путем нахождения MD5-хеша от строки
"ID Вашего магазина:Сумма платежа:Секретное слово 2:Номер заказа"
Пример на PHP:

  md5($_REQUEST['MERCHANT_ID'].':'.$_REQUEST['AMOUNT'].':secret2:'.$_REQUEST['MERCHANT_ORDER_ID'])
1.8. Список доступных валют
ID	Название
1	FK WALLET RUB
2	FK WALLET USD
3	FK WALLET EUR
4	VISA RUB
6	Yoomoney
7	VISA UAH
8	MasterCard RUB
9	MasterCard UAH
10	Qiwi
11	VISA EUR
12	МИР
13	Онлайн банк
14	USDT (ERC20)
15	USDT (TRC20)
16	Bitcoin Cash
17	BNB
18	DASH
19	Dogecoin
20	ZCash
21	Monero
22	Waves
23	Ripple
24	Bitcoin
25	Litecoin
26	Ethereum
27	SteamPay
28	Мегафон
32	VISA USD
33	Perfect Money USD
34	Shiba Inu
35	QIWI API
36	Card RUB API
37	Google pay
38	Apple pay
39	Tron
40	Webmoney WMZ
41	VISA / MasterCard KZT
42	СБП
44	СБП (API)
Описание API
API
2. Введение
2.1. Общая информация
Все запросы отправляются на урл https://api.fk.life/v1/ в формате JSON. Перед началом работы необходимо получить API ключ на странице настроек в личном кабинете

2.2. Подпись запросов
С каждым запросом необходимо передавать параметр signature, он формируется следующим образом:

Сортируем массив запросов по ключам в алфавитном порядке и конкатенируем (объединяем) их значения с разделителем | . Хешируем получившуюся строку в sha256, используя API ключ, например

    <?php

    $data = [
        'shopId'=>777,
        'nonce'=>time(),
    ];
    ksort($data);
    $sign = hash_hmac('sha256', implode('|', $data), $api_key);
    $data['signature'] = $sign;

    $request = json_encode($data);

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, 'https://api.fk.life/v1/balance');
    curl_setopt($ch, CURLOPT_HEADER, 0);
    curl_setopt($ch, CURLOPT_FAILONERROR, 0);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $request);
    $result = trim(curl_exec($ch));
    curl_close($ch);

    $response = json_decode($result, true);
2.3. Статусы заказов
Статус
Описание
0	Новый
1	Оплачен
6	Возврат
8	Ошибка
9	Отмена
2.4. Рекуррентные платежи
Для создания рекуррентного платежа необходимо в запросе на создание заказа /orders/create передать дополнительные параметры:

    recurrent:"Y"
    recurrent_period:"month"
    recurrent_description:"Подписка на VPN"
В ответе будет содержаться стандартная информация о созданном заказе, а также необходимая информация о рекуррентном платеже

    recurrent_order->id - номер рекуррентного платежа для повторной оплаты
    recurrent_order->pay_date_at - дата и время для повторной оплаты
После того, как пользователь успешно произведет первую оплату и после наступления даты для повторной оплаты, в запросе на создание заказа /orders/create отправьте параметр recurrent_order_id с номером рекуррентного платежа из предыдущего ответа. В случае успеха на ваш notification_url придет стандартное уведомление об успешной оплате

2.5. Доступные методы
Заказы
Работа с заказами

Список заказов
query Parameters
shopId
required
integer
Example: shopId=777
ID магазина

nonce
required
integer
Example: nonce=123456789
Уникальный ID запроса, должен всегда быть больше предыдущего значения

signature
required
string
Example: signature=190f3e3b87275da51031223a010e6da6
Подпись запроса

orderId	
integer
Example: orderId=123456789
Номер заказа Freekassa

paymentId	
string
Example: paymentId=987654321
Номер заказа в Вашем магазине

orderStatus	
integer
Example: orderStatus=1
Статус заказа

dateFrom	
string
Example: dateFrom=2021-01-01 13:45:21
Дата с

dateTo	
string
Example: dateTo=2021-01-02 13:45:21
Дата по

page	
integer
Страница

Responses