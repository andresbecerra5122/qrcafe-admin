import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  CreateRestaurantOnboardingRequest,
  CreateRestaurantOnboardingResponse
} from '../models/platform-onboarding.model';

@Injectable({ providedIn: 'root' })
export class PlatformOnboardingService {
  private readonly baseUrl = environment.apiBaseUrl;

  constructor(private readonly http: HttpClient) {}

  createRestaurant(request: CreateRestaurantOnboardingRequest): Observable<CreateRestaurantOnboardingResponse> {
    return this.http.post<CreateRestaurantOnboardingResponse>(
      `${this.baseUrl}/ops/platform/onboarding/restaurants`,
      request
    );
  }
}
