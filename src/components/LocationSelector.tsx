import { useEffect, useMemo, useState } from "react";
import { Country, State, City } from "country-state-city";
import { getDistrictsByState, getCitiesByDistrict } from "@/data/locationData";

const API_URL = "https://restcountries.com/v3.1/all?fields=name";

export interface LocationValue {
  country: string;
  state: string;
  district: string;
  city: string;
}

interface LocationSelectorProps {
  value: LocationValue;
  onChange: (value: LocationValue) => void;
  selectClassName?: string;
  labelClassName?: string;
  fieldClassName?: string;
}

// Map country name → ISO code for the package lookup (states/cities)
const countryByName = new Map(
  Country.getAllCountries().map((c) => [c.name, c.isoCode])
);

// Countries that have local district-level data (State → District → City)
const DISTRICT_COUNTRIES = new Set(["India"]);

export default function LocationSelector({
  value,
  onChange,
  selectClassName = "w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary appearance-none",
  labelClassName = "text-xs font-medium text-muted-foreground mb-1.5 block",
  fieldClassName,
}: LocationSelectorProps) {
  const [countries, setCountries] = useState<string[]>([]);
  const [loadingCountries, setLoadingCountries] = useState(true);
  const [countryError, setCountryError] = useState<string | null>(null);

  // Fetch countries from REST Countries API
  useEffect(() => {
    let cancelled = false;

    async function fetchCountries() {
      setLoadingCountries(true);
      setCountryError(null);
      try {
        const res = await fetch(API_URL);
        if (!res.ok) throw new Error(`Failed to fetch countries (${res.status})`);
        const data: Array<{ name: { common: string } }> = await res.json();
        if (!cancelled) {
          const names = data.map((c) => c.name.common).sort((a, b) => a.localeCompare(b));
          setCountries(names);
        }
      } catch (err: any) {
        if (!cancelled) {
          setCountryError(err.message ?? "Failed to load countries");
          // Fallback: use country-state-city package data
          setCountries(
            Country.getAllCountries()
              .map((c) => c.name)
              .sort((a, b) => a.localeCompare(b))
          );
        }
      } finally {
        if (!cancelled) setLoadingCountries(false);
      }
    }

    fetchCountries();
    return () => { cancelled = true; };
  }, []);

  const countryCode = countryByName.get(value.country) ?? "";

  const states = useMemo(() => {
    if (!countryCode) return [];
    return State.getStatesOfCountry(countryCode).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [countryCode]);

  // Find ISO state code from name
  const stateCode = useMemo(
    () => states.find((s) => s.name === value.state)?.isoCode ?? "",
    [states, value.state]
  );

  const hasDistricts = DISTRICT_COUNTRIES.has(value.country);

  // Districts from local data (only for countries like India)
  const districts = useMemo(() => {
    if (!hasDistricts || !value.state) return [];
    return getDistrictsByState(value.country, value.state);
  }, [hasDistricts, value.country, value.state]);

  // Cities: from local data if using districts path, otherwise from package
  const cities = useMemo(() => {
    if (hasDistricts && value.district) {
      return getCitiesByDistrict(value.country, value.state, value.district);
    }
    if (!hasDistricts && countryCode && stateCode) {
      return City.getCitiesOfState(countryCode, stateCode)
        .map((c) => c.name)
        .sort((a, b) => a.localeCompare(b));
    }
    return [];
  }, [hasDistricts, value.country, value.state, value.district, countryCode, stateCode]);

  return (
    <>
      {/* Country — from REST Countries API */}
      <div className={fieldClassName}>
        <label className={labelClassName}>Country *</label>
        <select
          value={value.country}
          disabled={loadingCountries}
          onChange={(e) =>
            onChange({ country: e.target.value, state: "", district: "", city: "" })
          }
          className={selectClassName}
        >
          <option value="">
            {loadingCountries ? "Loading countries…" : "Select a country"}
          </option>
          {countries.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {countryError && (
          <p className="text-xs text-destructive mt-1">
            {countryError} — showing offline data
          </p>
        )}
      </div>

      {/* State */}
      {value.country && states.length > 0 && (
        <div className={fieldClassName}>
          <label className={labelClassName}>State *</label>
          <select
            value={value.state}
            onChange={(e) =>
              onChange({ ...value, state: e.target.value, district: "", city: "" })
            }
            className={selectClassName}
          >
            <option value="">Select a state</option>
            {states.map((st) => (
              <option key={st.isoCode} value={st.name}>
                {st.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* District (only for countries with local district data) */}
      {hasDistricts && value.state && districts.length > 0 && (
        <div className={fieldClassName}>
          <label className={labelClassName}>District *</label>
          <select
            value={value.district}
            onChange={(e) =>
              onChange({ ...value, district: e.target.value, city: "" })
            }
            className={selectClassName}
          >
            <option value="">Select a district</option>
            {districts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* City */}
      {((hasDistricts && value.district) || (!hasDistricts && value.state)) &&
        cities.length > 0 && (
          <div className={fieldClassName}>
            <label className={labelClassName}>City *</label>
            <select
              value={value.city}
              onChange={(e) => onChange({ ...value, city: e.target.value })}
              className={selectClassName}
            >
              <option value="">Select a city</option>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        )}
    </>
  );
}
