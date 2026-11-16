/**
 * Аугментация типов Express: добавляем в объект request
 * поле adminUsername, которое проставляет middleware requireAdmin.
 *
 * ЭТОТ ФАЙЛ ЧИНит ОШИБКУ СБОРКИ:
 *   error TS2352: Conversion of type 'Request<...>' to type
 *   'Request & { adminUsername?: string }' may be a mistake...
 *
 * Причина: без этой аугментации имя "Request" в выражении
 *   (req as Request & { adminUsername?: string })
 * превращается в ГЛОБАЛЬНЫЙ тип Request из Fetch API (у него есть
 * cache, credentials, destination, integrity...) — поэтому TS и пишет
 * "missing the following properties ... cache, credentials, ...".
 *
 * После аугментации каст вообще не нужен: в любом роуте/мидлвари
 * просто пишем req.adminUsername = "admin" — и TypeScript доволен.
 */
import "express";

declare global {
  namespace Express {
    interface Request {
      /** Логин администратора из проверенного JWT (ставит requireAdmin) */
      adminUsername?: string;
    }
  }
}

export {};
