export const errorCatalog: Record<string, [string, string]> = Object.fromEntries(`
Add a title.|Adaugă un titlu.|Добавьте заголовок.
Paste one public 999.md advert URL.|Introdu un link către un anunț public de pe 999.md.|Вставьте ссылку на публичное объявление 999.md.
That is not a valid URL.|Acesta nu este un URL valid.|Некорректный URL.
Only public HTTPS advert links hosted on 999.md are supported.|Sunt acceptate doar linkuri HTTPS către anunțuri publice de pe 999.md.|Поддерживаются только HTTPS-ссылки на публичные объявления 999.md.
Paste an individual advert URL, not a category or search page.|Introdu linkul unui anunț individual, nu al unei categorii sau căutări.|Вставьте ссылку на отдельное объявление, а не на категорию или поиск.
The connection to 999.md failed ({0}). Automatic updates will retry.|Conexiunea la 999.md a eșuat ({0}). Actualizările automate vor fi reîncercate.|Сбой подключения к 999.md ({0}). Автообновление повторится.
The advert redirected too many times.|Anunțul a redirecționat de prea multe ori.|Слишком много перенаправлений объявления.
999.md redirected outside its public advert domain.|999.md a redirecționat în afara domeniului său public de anunțuri.|999.md перенаправил за пределы домена публичных объявлений.
999.md declined the automated page request (HTTP {0}). Open the advert normally and complete any missing details manually.|999.md a refuzat cererea automată (HTTP {0}). Deschide anunțul și completează manual detaliile lipsă.|999.md отклонил автоматический запрос (HTTP {0}). Откройте объявление и заполните недостающие данные вручную.
That 999.md advert could not be found. It may have expired or been removed.|Anunțul 999.md nu a fost găsit. Este posibil să fi expirat sau să fi fost șters.|Объявление 999.md не найдено. Возможно, оно истекло или удалено.
999.md returned HTTP {0}.|999.md a returnat HTTP {0}.|999.md вернул HTTP {0}.
The supplied link did not return a public HTML advert page.|Linkul nu a returnat o pagină HTML cu un anunț public.|По ссылке не получена публичная HTML-страница объявления.
The advert page is larger than the importer allows.|Pagina anunțului depășește dimensiunea permisă pentru import.|Размер страницы объявления превышает лимит импорта.
Empty advert response.|Răspuns gol pentru anunț.|Пустой ответ объявления.
999.md requires a browser verification. Please retry later.|999.md solicită o verificare în browser. Încearcă mai târziu.|999.md требует проверку в браузере. Повторите позже.
Could not open the public advert.|Anunțul public nu a putut fi deschis.|Не удалось открыть публичное объявление.
The importer is busy. Please try again shortly.|Importatorul este ocupat. Încearcă din nou în curând.|Импорт занят. Повторите через некоторое время.
The public page did not expose listing details. Please retry later.|Pagina publică nu a afișat detaliile anunțului. Încearcă mai târziu.|Публичная страница не предоставила данные объявления. Повторите позже.
Too many imports. Please wait a minute.|Prea multe importuri. Așteaptă un minut.|Слишком много импортов. Подождите минуту.
Please wait a minute before updating more offers.|Așteaptă un minut înainte de a actualiza alte oferte.|Подождите минуту перед обновлением других объявлений.
Updates are busy. Please retry shortly.|Actualizările sunt ocupate. Încearcă în curând.|Обновление занято. Повторите немного позже.
Marketplace updates are busy. They will retry shortly.|Actualizările platformei sunt ocupate. Vor fi reîncercate în curând.|Обновление площадки занято. Повторится немного позже.
A verified public username is required.|Este necesar un nume public de utilizator verificat.|Требуется подтверждённое публичное имя пользователя.
999.md did not return its public offers. Saved details are kept.|999.md nu a returnat ofertele publice. Detaliile salvate au fost păstrate.|999.md не вернул публичные объявления. Сохранённые данные оставлены.
999.md is limiting updates. They will retry later.|999.md limitează actualizările. Vor fi reîncercate mai târziu.|999.md ограничивает обновления. Они повторятся позже.
Public offers are unavailable from 999.md.|Ofertele publice de pe 999.md nu sunt disponibile.|Публичные объявления 999.md недоступны.
Empty marketplace response.|Răspuns gol de la platformă.|Пустой ответ площадки.
Marketplace response exceeded its limit.|Răspunsul platformei a depășit limita.|Ответ площадки превысил лимит.
Exchange rates temporarily unavailable.|Cursurile valutare sunt temporar indisponibile.|Курсы валют временно недоступны.
Invalid login credentials|Date de autentificare incorecte|Неверный логин или пароль
Email not confirmed|E-mail neconfirmat|Почта не подтверждена
Invalid email or password.|E-mail sau parolă incorecte.|Неверная почта или пароль.
Email rate limit exceeded|Prea multe e-mailuri solicitate|Превышен лимит отправки писем
User already registered|Utilizatorul este deja înregistrat|Пользователь уже зарегистрирован
Failed to fetch|Conexiunea a eșuat|Не удалось подключиться
Network request failed|Cererea de rețea a eșuat|Сбой сетевого запроса
Add a description.|Adaugă o descriere.|Добавьте описание.
Add a second title.|Adaugă al doilea titlu.|Добавьте второй заголовок.
Add the second title required by 999.md.|Adaugă al doilea titlu cerut de 999.md.|Добавьте второй заголовок, необходимый для 999.md.
Add at least one photo.|Adaugă cel puțin o fotografie.|Добавьте хотя бы одно фото.
Add the brand and model.|Adaugă marca și modelul.|Укажите бренд и модель.
Add the device type.|Adaugă tipul dispozitivului.|Укажите тип устройства.
Add the location.|Adaugă localitatea.|Укажите местоположение.
Add the operating system.|Adaugă sistemul de operare.|Укажите операционную систему.
A specification is too long.|O specificație este prea lungă.|Слишком длинная характеристика.
The second title must be no longer than 100 characters.|Al doilea titlu nu poate depăși 100 de caractere.|Второй заголовок не должен превышать 100 символов.
Enter a valid amount.|Introdu o sumă validă.|Введите корректную сумму.
Enter a valid asking price.|Introdu un preț valid.|Введите корректную цену продажи.
Enter a valid price for each selected account.|Introdu un preț valid pentru fiecare cont selectat.|Укажите корректную цену для каждого выбранного аккаунта.
Enter a valid profit amount.|Introdu un profit valid.|Введите корректную сумму прибыли.
Enter an amount with up to two decimal places.|Introdu o sumă cu cel mult două zecimale.|Введите сумму с точностью до двух знаков после запятой.
Enter battery capacity in mAh.|Introdu capacitatea bateriei în mAh.|Укажите ёмкость аккумулятора в мАч.
Battery health must be between 0 and 100%.|Starea bateriei trebuie să fie între 0 și 100%.|Состояние аккумулятора должно быть от 0 до 100%.
Choose Romanian or Russian.|Alege româna sau rusa.|Выберите румынский или русский.
Choose a supported currency.|Alege o monedă acceptată.|Выберите поддерживаемую валюту.
Choose between one and twenty different accounts.|Alege între unul și douăzeci de conturi diferite.|Выберите от одного до двадцати разных аккаунтов.
Choose JPEG, PNG or WebP photographs.|Alege fotografii JPEG, PNG sau WebP.|Выберите фотографии JPEG, PNG или WebP.
Choose JPEG, PNG or WebP photos.|Alege fotografii JPEG, PNG sau WebP.|Выберите фото JPEG, PNG или WebP.
Use valid JPEG, PNG or WebP photos.|Folosește fotografii JPEG, PNG sau WebP valide.|Используйте корректные фото JPEG, PNG или WebP.
Choose a photo smaller than 80 megapixels.|Alege o fotografie mai mică de 80 megapixeli.|Выберите фото меньше 80 мегапикселей.
Choose up to 10 photos. Remove a photo to make room.|Alege cel mult 10 fotografii. Elimină una pentru a face loc.|Выберите не более 10 фото. Удалите фото, чтобы освободить место.
Use at most {0} photographs.|Folosește cel mult {0} fotografii.|Используйте не более {0} фотографий.
Use at most {0} photos.|Folosește cel mult {0} fotografii.|Используйте не более {0} фото.
{0} is larger than 12 MB.|{0} depășește 12 MB.|{0} превышает 12 МБ.
Photos must total less than 25 MB.|Fotografiile trebuie să aibă sub 25 MB în total.|Общий размер фото должен быть меньше 25 МБ.
Remove a photo before adding another camera photo.|Elimină o fotografie înainte de a adăuga alta de la cameră.|Удалите фото перед добавлением нового снимка.
Photo could not be prepared.|Fotografia nu a putut fi pregătită.|Не удалось подготовить фото.
The photo could not be prepared.|Fotografia nu a putut fi pregătită.|Не удалось подготовить фото.
This photo is too large to prepare safely. Export a smaller copy first.|Fotografia este prea mare pentru pregătire. Exportă mai întâi o copie mai mică.|Фото слишком большое для обработки. Сначала экспортируйте уменьшенную копию.
Photo preparation is unavailable in this browser.|Pregătirea fotografiilor nu este disponibilă în acest browser.|Обработка фото недоступна в этом браузере.
Photo preparation is unavailable on this device.|Pregătirea fotografiilor nu este disponibilă pe acest dispozitiv.|Обработка фото недоступна на этом устройстве.
Image preparation cancelled|Pregătirea imaginii a fost anulată|Подготовка изображения отменена
The camera returned an empty photo.|Camera a returnat o fotografie goală.|Камера вернула пустое фото.
The captured photo is no longer available.|Fotografia capturată nu mai este disponibilă.|Сделанное фото больше недоступно.
The camera result has an invalid destination.|Destinația rezultatului camerei nu este validă.|Некорректный адрес результата камеры.
Invalid photo.|Fotografie nevalidă.|Некорректное фото.
Invalid photo metadata.|Metadatele fotografiei nu sunt valide.|Некорректные метаданные фото.
Photo data does not match its format.|Datele fotografiei nu corespund formatului.|Данные фото не соответствуют формату.
Photo payload is incomplete.|Datele fotografiei sunt incomplete.|Данные фото неполные.
Photo payload exceeds its limits or is incomplete.|Datele fotografiei depășesc limitele sau sunt incomplete.|Данные фото превышают ограничения или неполные.
A photo was truncated during transfer.|O fotografie a fost trunchiată în timpul transferului.|Фото было обрезано при передаче.
A synced photo is incomplete. Local drafts were kept.|O fotografie sincronizată este incompletă. Ciornele locale au fost păstrate.|Синхронизированное фото неполное. Локальные черновики сохранены.
A private photo could not be downloaded.|O fotografie privată nu a putut fi descărcată.|Не удалось скачать личное фото.
Could not save this setting.|Setarea nu a putut fi salvată.|Не удалось сохранить настройку.
Could not open your browser.|Browserul nu a putut fi deschis.|Не удалось открыть браузер.
Could not open saved accounts. Try again.|Conturile salvate nu au putut fi deschise. Încearcă din nou.|Не удалось открыть сохранённые аккаунты. Повторите попытку.
Could not select this account. Try again.|Contul nu a putut fi selectat. Încearcă din nou.|Не удалось выбрать аккаунт. Повторите попытку.
Could not update this connection. Please try again.|Conexiunea nu a putut fi actualizată. Încearcă din nou.|Не удалось обновить подключение. Повторите попытку.
This login is already saved.|Acest login este deja salvat.|Этот логин уже сохранён.
You're offline. Connect to the internet and try again.|Ești offline. Conectează-te la internet și încearcă din nou.|Вы не в сети. Подключитесь к интернету и повторите попытку.
You're offline. Connect to the internet to open your account.|Ești offline. Conectează-te la internet pentru a deschide contul.|Вы не в сети. Подключитесь к интернету для открытия аккаунта.
Your private session is not ready. Please try again.|Sesiunea privată nu este gata. Încearcă din nou.|Личная сессия ещё не готова. Повторите попытку.
Your account link couldn't be opened. Please try again.|Linkul contului nu a putut fi deschis. Încearcă din nou.|Не удалось открыть ссылку аккаунта. Повторите попытку.
This account link has expired. Request a new one in the Resell app.|Linkul contului a expirat. Solicită unul nou în aplicația Resell.|Срок действия ссылки истёк. Запросите новую в приложении Resell.
Return to the Resell app and sign in.|Revino în aplicația Resell și autentifică-te.|Вернитесь в приложение Resell и войдите.
Open the app to request a new link.|Deschide aplicația pentru a solicita un link nou.|Откройте приложение, чтобы запросить новую ссылку.
Verification could not be completed. Please try again.|Verificarea nu a putut fi finalizată. Încearcă din nou.|Не удалось завершить проверку. Повторите попытку.
Your email is not verified yet. Please try the latest code.|E-mailul nu este încă verificat. Folosește cel mai recent cod.|Почта ещё не подтверждена. Используйте последний код.
That code is incorrect or expired. Try again or request a new code.|Codul este incorect sau a expirat. Încearcă din nou sau solicită alt cod.|Код неверный или просрочен. Повторите попытку или запросите новый код.
Please wait a moment before requesting another code.|Așteaptă puțin înainte de a solicita alt cod.|Подождите немного перед запросом нового кода.
Enter a valid inventory code or shared link.|Introdu un cod de inventar sau un link partajat valid.|Введите корректный код инвентаря или ссылку.
Enter a valid viewing code or link.|Introdu un cod sau un link de vizualizare valid.|Введите корректный код или ссылку просмотра.
Paste a valid private inventory link.|Introdu un link valid către un inventar privat.|Вставьте корректную ссылку на личный инвентарь.
Invalid inventory code.|Cod de inventar nevalid.|Некорректный код инвентаря.
Invalid private link.|Link privat nevalid.|Некорректная личная ссылка.
A private link must use HTTPS.|Un link privat trebuie să folosească HTTPS.|Личная ссылка должна использовать HTTPS.
Use a secure sharing address.|Folosește o adresă securizată pentru partajare.|Используйте защищённый адрес для общего доступа.
Inventory viewing is unavailable.|Vizualizarea inventarului nu este disponibilă.|Просмотр инвентаря недоступен.
This inventory could not be opened.|Inventarul nu a putut fi deschis.|Не удалось открыть инвентарь.
This inventory couldn't be opened. Check the code, or ask its owner for a new one.|Inventarul nu a putut fi deschis. Verifică codul sau solicită unul nou de la proprietar.|Не удалось открыть инвентарь. Проверьте код или попросите владельца предоставить новый.
Unable to open inventory.|Inventarul nu poate fi deschis.|Не удалось открыть инвентарь.
Could not create a viewing code.|Codul de vizualizare nu a putut fi creat.|Не удалось создать код просмотра.
Connect to Supabase before creating a private link.|Conectează Supabase înainte de a crea un link privat.|Подключитесь к Supabase перед созданием личной ссылки.
Cloud sync is not configured for this build.|Sincronizarea cloud nu este configurată în această versiune.|Облачная синхронизация не настроена в этой сборке.
Clipboard access is unavailable in this browser.|Accesul la clipboard nu este disponibil în acest browser.|Доступ к буферу обмена недоступен в этом браузере.
Clipboard unavailable. Copy the viewing code instead.|Clipboardul nu este disponibil. Copiază codul de vizualizare.|Буфер обмена недоступен. Скопируйте код просмотра.
Connected to the private inventory. Existing inventories on this browser were kept separately.|Conectat la inventarul privat. Inventarele existente în acest browser au fost păstrate separat.|Подключено к личному инвентарю. Существующие инвентари в браузере сохранены отдельно.
Connected to the private inventory. Previous inventories remain saved separately.|Conectat la inventarul privat. Inventarele anterioare rămân salvate separat.|Подключено к личному инвентарю. Предыдущие инвентари сохранены отдельно.
Could not establish private storage. Your records remain on this device.|Stocarea privată nu a putut fi creată. Înregistrările rămân pe acest dispozitiv.|Не удалось создать личное хранилище. Записи остаются на этом устройстве.
Private storage did not return a valid workspace.|Stocarea privată nu a returnat un spațiu valid.|Личное хранилище не вернуло корректное рабочее пространство.
The private inventory table has not been installed yet.|Tabelul inventarului privat nu a fost încă instalat.|Таблица личного инвентаря ещё не установлена.
Local storage could not be opened.|Stocarea locală nu a putut fi deschisă.|Не удалось открыть локальное хранилище.
Close other inventory tabs and retry.|Închide celelalte file cu inventarul și reîncearcă.|Закройте другие вкладки инвентаря и повторите попытку.
Close other offer-sandbox tabs, then retry.|Închide celelalte file de testare a ofertelor și reîncearcă.|Закройте другие вкладки тестирования объявлений и повторите попытку.
Inventory changed during its update. Try again.|Inventarul s-a modificat în timpul actualizării. Încearcă din nou.|Инвентарь изменился во время обновления. Повторите попытку.
A cloud record is invalid. Your local inventory is unchanged.|O înregistrare cloud nu este validă. Inventarul local nu a fost modificat.|Некорректная запись в облаке. Локальный инвентарь не изменён.
Local sync transaction was cancelled.|Tranzacția de sincronizare locală a fost anulată.|Локальная синхронизация отменена.
Invalid device records.|Înregistrări de dispozitive nevalide.|Некорректные записи устройств.
Unsupported backup.|Copie de rezervă neacceptată.|Неподдерживаемая резервная копия.
No previous restore to recover.|Nu există o restaurare anterioară de recuperat.|Нет предыдущего восстановления для возврата.
Inventory updates require HTTPS.|Actualizările inventarului necesită HTTPS.|Для обновления инвентаря требуется HTTPS.
Marketplace updates require HTTPS.|Actualizările marketplace necesită HTTPS.|Для обновления площадки требуется HTTPS.
The configured importer must use HTTPS.|Importatorul configurat trebuie să folosească HTTPS.|Настроенный импорт должен использовать HTTPS.
Could not reach the importer. Check your connection; updates will retry automatically.|Importatorul nu poate fi accesat. Verifică conexiunea; actualizările vor fi reîncercate automat.|Не удалось связаться с импортом. Проверьте соединение; обновление повторится автоматически.
Import connection ended. Please retry.|Conexiunea de import s-a încheiat. Încearcă din nou.|Соединение импорта прервано. Повторите попытку.
Import failed.|Importul a eșuat.|Не удалось импортировать.
Could not import this offer. {0}|Oferta nu a putut fi importată. {0}|Не удалось импортировать объявление. {0}
Invalid account feed.|Flux de cont nevalid.|Некорректные данные аккаунта.
The account feed is incomplete. Try again.|Fluxul de cont este incomplet. Încearcă din nou.|Данные аккаунта неполные. Повторите попытку.
Invalid marketplace response.|Răspuns marketplace nevalid.|Некорректный ответ площадки.
Could not save monitored offers.|Ofertele urmărite nu au putut fi salvate.|Не удалось сохранить отслеживаемые объявления.
Could not update public offers.|Ofertele publice nu au putut fi actualizate.|Не удалось обновить публичные объявления.
Could not verify available offers.|Ofertele disponibile nu au putut fi verificate.|Не удалось проверить доступные объявления.
Draft could not be saved.|Ciorna nu a putut fi salvată.|Не удалось сохранить черновик.
Draft could not be removed.|Ciorna nu a putut fi ștearsă.|Не удалось удалить черновик.
Draft save was interrupted.|Salvarea ciornei a fost întreruptă.|Сохранение черновика прервано.
Could not save this draft. {0}|Ciorna nu a putut fi salvată. {0}|Не удалось сохранить черновик. {0}
Could not save this draft: {0}|Ciorna nu a putut fi salvată: {0}|Не удалось сохранить черновик: {0}
Could not commit the synced draft.|Ciorna sincronizată nu a putut fi salvată.|Не удалось сохранить синхронизированный черновик.
Could not save the offer change.|Modificarea ofertei nu a putut fi salvată.|Не удалось сохранить изменение объявления.
Could not save the queue change. Please try again.|Modificarea cozii nu a putut fi salvată. Încearcă din nou.|Не удалось сохранить изменение очереди. Повторите попытку.
Could not close the offer. Your draft was kept.|Oferta nu a putut fi închisă. Ciorna a fost păstrată.|Не удалось закрыть объявление. Черновик сохранён.
This draft changed on another device. A separate copy of these edits was kept.|Ciorna s-a modificat pe alt dispozitiv. O copie separată a acestor modificări a fost păstrată.|Черновик изменился на другом устройстве. Отдельная копия этих правок сохранена.
A draft changed on another device before deletion. The newer draft was kept.|Ciorna s-a modificat pe alt dispozitiv înainte de ștergere. Versiunea nouă a fost păstrată.|Черновик изменился на другом устройстве перед удалением. Новая версия сохранена.
This draft is no longer available.|Ciorna nu mai este disponibilă.|Черновик больше недоступен.
This draft no longer accepts photos.|Ciorna nu mai acceptă fotografii.|В этот черновик больше нельзя добавить фото.
This draft has no marketplace publication to close.|Ciorna nu are o publicație marketplace de închis.|У черновика нет публикации на площадке для закрытия.
This offer is no longer available.|Oferta nu mai este disponibilă.|Объявление больше недоступно.
This offer is public again. Its draft was kept.|Oferta este din nou publică. Ciorna a fost păstrată.|Объявление снова опубликовано. Черновик сохранён.
This offer file is too large.|Fișierul ofertei este prea mare.|Файл объявления слишком большой.
This offer was already submitted to a selected account. Check Inventory before creating another listing.|Oferta a fost deja trimisă unui cont selectat. Verifică Inventarul înainte de a crea alt anunț.|Объявление уже отправлено в выбранный аккаунт. Проверьте инвентарь перед созданием нового объявления.
Offer sync requires the workspace account.|Sincronizarea ofertelor necesită contul spațiului de lucru.|Для синхронизации объявлений требуется аккаунт пространства.
Cloud offer verification failed. Local drafts were kept.|Verificarea ofertelor cloud a eșuat. Ciornele locale au fost păstrate.|Проверка облачных объявлений не удалась. Локальные черновики сохранены.
The cloud did not confirm this offer.|Cloudul nu a confirmat oferta.|Облако не подтвердило объявление.
Invalid offer transfer.|Transfer de ofertă nevalid.|Некорректный перенос объявления.
Unsupported offer transfer.|Transfer de ofertă neacceptat.|Неподдерживаемый перенос объявления.
Invalid offer specifications.|Specificațiile ofertei nu sunt valide.|Некорректные характеристики объявления.
Invalid offer type.|Tip de ofertă nevalid.|Некорректный тип объявления.
Invalid template name.|Numele șablonului nu este valid.|Некорректное название шаблона.
Invalid account prices.|Prețurile conturilor nu sunt valide.|Некорректные цены аккаунтов.
Invalid price.|Preț nevalid.|Некорректная цена.
Invalid publication price.|Preț de publicare nevalid.|Некорректная цена публикации.
Invalid published offers.|Oferte publicate nevalide.|Некорректные опубликованные объявления.
Invalid sale.|Vânzare nevalidă.|Некорректная продажа.
Invalid sale status.|Stare a vânzării nevalidă.|Некорректный статус продажи.
Invalid closed sale.|Vânzare închisă nevalidă.|Некорректная закрытая продажа.
Invalid cloud offer.|Ofertă cloud nevalidă.|Некорректное облачное объявление.
Invalid cloud offer choices.|Opțiuni de ofertă cloud nevalide.|Некорректные варианты облачного объявления.
Invalid cloud offer field.|Câmp de ofertă cloud nevalid.|Некорректное поле облачного объявления.
Invalid cloud offer metadata.|Metadate de ofertă cloud nevalide.|Некорректные метаданные облачного объявления.
Invalid cloud offer revision.|Revizie de ofertă cloud nevalidă.|Некорректная версия облачного объявления.
Invalid cloud photo metadata.|Metadate foto cloud nevalide.|Некорректные метаданные облачного фото.
Invalid private photo path or size.|Calea sau dimensiunea fotografiei private nu este validă.|Некорректный путь или размер личного фото.
Invalid {0}.|Valoare nevalidă pentru {0}.|Некорректное значение: {0}.
Create an offer to prepare it on 999.md.|Creează o ofertă pentru a o pregăti pe 999.md.|Создайте объявление для подготовки на 999.md.
Preparation cancelled|Pregătire anulată|Подготовка отменена
Resume or stop the unfinished preparation first.|Mai întâi continuă sau oprește pregătirea nefinalizată.|Сначала продолжите или остановите незавершённую подготовку.
Saved preparation could not be read.|Pregătirea salvată nu a putut fi citită.|Не удалось прочитать сохранённую подготовку.
The queued draft is not available on this device.|Ciorna din coadă nu este disponibilă pe acest dispozitiv.|Черновик из очереди недоступен на этом устройстве.
Open the mobile-phones advert creator first.|Deschide mai întâi formularul de anunț pentru telefoane mobile.|Сначала откройте форму создания объявления о мобильном телефоне.
Preparation is restricted to the 999.md creator.|Pregătirea este limitată la formularul de creare 999.md.|Подготовка доступна только в форме создания 999.md.
This creator already has a title or photos. Open a fresh creator so existing work is not overwritten.|Formularul are deja un titlu sau fotografii. Deschide unul nou pentru a nu suprascrie datele existente.|В форме уже есть заголовок или фотографии. Откройте новую форму, чтобы сохранить существующую работу.
Device type was not accepted. Finish the first step manually, then retry.|Tipul dispozitivului nu a fost acceptat. Finalizează manual primul pas, apoi reîncearcă.|Тип устройства не принят. Завершите первый шаг вручную и повторите попытку.
The signed-in account changed. Preparation stopped; check the account and retry.|Contul autentificat s-a schimbat. Pregătirea s-a oprit; verifică contul și reîncearcă.|Аккаунт изменился. Подготовка остановлена; проверьте аккаунт и повторите попытку.
The cookie notice is still open. Accept it on 999.md, then prepare again.|Notificarea cookie este încă deschisă. Accept-o pe 999.md, apoi pregătește din nou.|Уведомление о cookie ещё открыто. Примите его на 999.md и повторите подготовку.
The marketplace first-step guide is still open. Close it, then prepare again.|Ghidul inițial al platformei este încă deschis. Închide-l, apoi pregătește din nou.|Начальная инструкция площадки ещё открыта. Закройте её и повторите подготовку.
The marketplace first-step guide has no recognized close control.|Ghidul inițial nu are un buton de închidere recunoscut.|Не найдена кнопка закрытия начальной инструкции площадки.
The marketplace form did not expose the expected control.|Formularul platformei nu a afișat câmpul așteptat.|Ожидаемый элемент формы площадки не найден.
The requested option is unavailable.|Opțiunea solicitată nu este disponibilă.|Запрошенный вариант недоступен.
The dependent field is still loading.|Câmpul dependent încă se încarcă.|Зависимое поле ещё загружается.
Photos: upload acceptance was not confirmed|Fotografii: acceptarea încărcării nu a fost confirmată|Фото: загрузка не подтверждена
Photos: upload control unavailable|Fotografii: controlul de încărcare nu este disponibil|Фото: элемент загрузки недоступен
Phone: select or verify this number on 999.md manually|Telefon: selectează sau verifică manual numărul pe 999.md|Телефон: выберите или подтвердите номер на 999.md вручную
{0}: choose {1} manually|{0}: alege manual {1}|{0}: выберите {1} вручную
{0}: the form did not retain the choice|{0}: formularul nu a păstrat opțiunea|{0}: форма не сохранила выбор
{0}: the form did not retain the value|{0}: formularul nu a păstrat valoarea|{0}: форма не сохранила значение
{0}: 999.md requires this title too. Add it in Resell or complete it on the form.|{0}: 999.md solicită și acest titlu. Adaugă-l în Resell sau completează-l în formular.|{0}: 999.md требует и этот заголовок. Добавьте его в Resell или заполните в форме.
{0} · {1} photos accepted. {2} {3}|{0} · {1} fotografii acceptate. {2} {3}|{0} · Принято фото: {1}. {2} {3}
Could not create the test photograph.|Fotografia de test nu a putut fi creată.|Не удалось создать тестовое фото.
The bundled test image is unavailable.|Imaginea de test inclusă nu este disponibilă.|Встроенное тестовое изображение недоступно.
The second test image is unavailable.|A doua imagine de test nu este disponibilă.|Второе тестовое изображение недоступно.
Resell field preparation failed|Pregătirea câmpurilor Resell a eșuat|Не удалось подготовить поля Resell
Resell offer preparation failed|Pregătirea ofertei Resell a eșuat|Не удалось подготовить объявление Resell
Resell preparation status|Starea pregătirii Resell|Состояние подготовки Resell
finding the selector|se caută selectorul|поиск элемента выбора
opening the choices|se deschid opțiunile|открытие вариантов
checking the selected value|se verifică valoarea selectată|проверка выбранного значения
closing the choices|se închid opțiunile|закрытие вариантов
waiting for the field to become available|se așteaptă disponibilitatea câmpului|ожидание доступности поля
? Drafts stay saved.|? Ciornele rămân salvate.|? Черновики сохранятся.
`.trim().split("\n").map(line => { const [en, ro, ru] = line.split("|"); return [en, [ro, ru] as [string, string]]; }));
