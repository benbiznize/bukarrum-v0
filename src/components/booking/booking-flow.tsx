"use client";

import { useReducer } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useDict } from "@/lib/i18n/dict-context";
import { StepLocation } from "./step-location";
import { StepResource } from "./step-resource";
import { StepDate } from "./step-date";
import { StepTime } from "./step-time";
import { StepDuration } from "./step-duration";
import { StepAddOns } from "./step-add-ons";
import { StepContact } from "./step-contact";
import { StepConfirmation } from "./step-confirmation";

type Step = "location" | "resource" | "date" | "time" | "duration" | "addons" | "contact" | "confirmation";

export type BookingState = {
  step: Step;
  tenantId: string;
  locationId: string | null;
  locationName: string | null;
  locationTimezone: string | null;
  resourceId: string | null;
  resourceName: string | null;
  hourlyRate: number | null;
  minDuration: number | null;
  maxDuration: number | null;
  date: string | null;
  startTime: string | null;
  availableUntil: string | null;
  durationHours: number | null;
  selectedAddOns: { id: string; name: string; price: number }[];
  error: string | null;
};

type Action =
  | { type: "SELECT_LOCATION"; locationId: string; locationName: string; locationTimezone: string }
  | { type: "SELECT_RESOURCE"; resourceId: string; resourceName: string; hourlyRate: number; minDuration: number; maxDuration: number }
  | { type: "SELECT_DATE"; date: string }
  | { type: "SELECT_TIME"; startTime: string; availableUntil: string }
  | { type: "SELECT_DURATION"; durationHours: number }
  | { type: "SELECT_ADD_ONS"; addOns: { id: string; name: string; price: number }[] }
  | { type: "GO_BACK" }
  | { type: "SET_ERROR"; error: string }
  | { type: "BOOKING_COMPLETE" };

const STEP_ORDER: Step[] = ["location", "resource", "date", "time", "duration", "addons", "contact", "confirmation"];

function reducer(state: BookingState, action: Action): BookingState {
  switch (action.type) {
    case "SELECT_LOCATION":
      return {
        ...state,
        step: "resource",
        locationId: action.locationId,
        locationName: action.locationName,
        locationTimezone: action.locationTimezone,
        resourceId: null, resourceName: null, hourlyRate: null, minDuration: null, maxDuration: null,
        date: null, startTime: null, availableUntil: null, durationHours: null, error: null,
      };
    case "SELECT_RESOURCE":
      return {
        ...state,
        step: "date",
        resourceId: action.resourceId,
        resourceName: action.resourceName,
        hourlyRate: action.hourlyRate,
        minDuration: action.minDuration,
        maxDuration: action.maxDuration,
        date: null, startTime: null, availableUntil: null, durationHours: null, error: null,
      };
    case "SELECT_DATE":
      return {
        ...state,
        step: "time",
        date: action.date,
        startTime: null, availableUntil: null, durationHours: null, error: null,
      };
    case "SELECT_TIME":
      return {
        ...state,
        step: "duration",
        startTime: action.startTime,
        availableUntil: action.availableUntil,
        error: null,
      };
    case "SELECT_DURATION":
      return {
        ...state,
        step: "addons",
        durationHours: action.durationHours,
        error: null,
      };
    case "SELECT_ADD_ONS":
      return {
        ...state,
        step: "contact",
        selectedAddOns: action.addOns,
        error: null,
      };
    case "GO_BACK": {
      const idx = STEP_ORDER.indexOf(state.step);
      if (idx <= 0) return state;
      const prev = STEP_ORDER[idx - 1];
      // Skip addons step on back if we auto-skipped it (no add-ons were selected)
      if (prev === "addons" && state.selectedAddOns.length === 0) {
        return { ...state, step: "duration", error: null };
      }
      return { ...state, step: prev, error: null };
    }
    case "SET_ERROR":
      return { ...state, error: action.error };
    case "BOOKING_COMPLETE":
      return { ...state, step: "confirmation", error: null };
    default:
      return state;
  }
}

type Location = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  timezone: string;
  image_url: string | null;
};

export function BookingFlow({
  tenantId,
  tenantName,
  locations,
}: {
  tenantId: string;
  tenantName: string;
  locations: Location[];
}) {
  const { booking } = useDict();
  const skipLocation = locations.length === 1;
  const initialStep: Step = skipLocation ? "resource" : "location";
  const initialLocation = skipLocation ? locations[0] : null;

  const [state, dispatch] = useReducer(reducer, {
    step: initialStep,
    tenantId,
    locationId: initialLocation?.id ?? null,
    locationName: initialLocation?.name ?? null,
    locationTimezone: initialLocation?.timezone ?? null,
    resourceId: null,
    resourceName: null,
    hourlyRate: null,
    minDuration: null,
    maxDuration: null,
    date: null,
    startTime: null,
    availableUntil: null,
    durationHours: null,
    selectedAddOns: [],
    error: null,
  });

  const stepIdx = STEP_ORDER.indexOf(state.step);
  const canGoBack = stepIdx > (skipLocation ? 1 : 0) && state.step !== "confirmation";

  return (
    <div className="w-full max-w-lg mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-center mb-1">{tenantName}</h1>
      <p className="text-muted-foreground text-center text-sm mb-6">{booking.bookYourSpace}</p>

      {state.step !== "confirmation" && (
        <div className="flex items-center gap-1 mb-6">
          {booking.stepLabels.map((label, i) => {
            const isActive = i === (skipLocation ? stepIdx + 1 : stepIdx);
            const isDone = i < (skipLocation ? stepIdx + 1 : stepIdx);
            return (
              <div key={label} className="flex-1">
                <div
                  className={`h-1.5 rounded-full transition-colors ${
                    isActive ? "bg-primary" : isDone ? "bg-primary/60" : "bg-muted"
                  }`}
                />
              </div>
            );
          })}
        </div>
      )}

      {canGoBack && (
        <Button
          variant="ghost"
          size="sm"
          className="mb-4 -ml-2"
          onClick={() => dispatch({ type: "GO_BACK" })}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          {booking.back}
        </Button>
      )}

      {state.step === "location" && (
        <StepLocation locations={locations} dispatch={dispatch} />
      )}
      {state.step === "resource" && state.locationId && (
        <StepResource locationId={state.locationId} dispatch={dispatch} />
      )}
      {state.step === "date" && state.resourceId && state.locationTimezone && (
        <StepDate
          resourceId={state.resourceId}
          timezone={state.locationTimezone}
          dispatch={dispatch}
        />
      )}
      {state.step === "time" && state.resourceId && state.date && state.locationTimezone && (
        <StepTime
          resourceId={state.resourceId}
          date={state.date}
          timezone={state.locationTimezone}
          dispatch={dispatch}
        />
      )}
      {state.step === "duration" && (
        <StepDuration state={state} dispatch={dispatch} />
      )}
      {state.step === "addons" && (
        <StepAddOns state={state} dispatch={dispatch} />
      )}
      {state.step === "contact" && (
        <StepContact state={state} dispatch={dispatch} />
      )}
      {state.step === "confirmation" && (
        <StepConfirmation state={state} />
      )}
    </div>
  );
}
