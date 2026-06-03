import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { CITIES, INDUSTRIES, SKILLS, TARGET_ROLES } from "../data/suggestions";
import { mergeOptions } from "../utils/fuzzyMatch";
import type { JobListItem } from "../api/types";

export function useJobSuggestions() {
  const [cityOptions, setCityOptions] = useState(CITIES);
  const [roleOptions, setRoleOptions] = useState(TARGET_ROLES);
  const [industryOptions, setIndustryOptions] = useState(INDUSTRIES);
  const [skillOptions, setSkillOptions] = useState(SKILLS);

  const refreshFromJobs = useCallback(async () => {
    try {
      const jobs = await api<JobListItem[]>("/api/v1/jobs?limit=200");
      setCityOptions(mergeOptions(CITIES, jobs.map((j) => j.city)));
      setIndustryOptions(mergeOptions(INDUSTRIES, jobs.map((j) => j.industry)));
      setRoleOptions(mergeOptions(TARGET_ROLES, jobs.map((j) => j.title)));
      const tagSkills = jobs.flatMap((j) => j.tags || []);
      setSkillOptions(mergeOptions(SKILLS, tagSkills));
    } catch {
      /* 使用静态库 */
    }
  }, []);

  useEffect(() => {
    refreshFromJobs();
  }, [refreshFromJobs]);

  return {
    cityOptions,
    roleOptions,
    industryOptions,
    skillOptions,
    refreshFromJobs,
  };
}
