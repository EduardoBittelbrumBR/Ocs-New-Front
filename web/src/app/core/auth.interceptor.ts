import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  return next(req).pipe(
    catchError((err) => {
      if (err?.status === 401 && req.url.startsWith('/api/')) {
        router.navigateByUrl('/login');
      }
      return throwError(() => err);
    }),
  );
};
