import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import TagAutocomplete from "../components/TagAutocomplete";
import { JOB_TYPES } from "../data/suggestions";
import { useJobSuggestions } from "../hooks/useJobSuggestions";
import type { Profile } from "../api/types";

export default function ProfilePage() {
  const { cityOptions, roleOptions, industryOptions } = useJobSuggestions();
  const [cities, setCities] = useState<string[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [industries, setIndustries] = useState<string[]>([]);
  const [jobType, setJobType] = useState("实习");
  const [bio, setBio] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api<Profile>("/api/v1/profile").then((p) => {
      setCities(p.target_cities || []);
      setRoles(p.target_roles || []);
      setIndustries(p.industries || []);
      setJobType(p.job_type || "实习");
      setBio(p.bio || "");
    });
  }, []);

  const save = async () => {
    const body = {
      target_cities: cities,
      target_roles: roles,
      industries: industries,
      job_type: jobType,
      bio,
    };
    await api("/api/v1/profile", { method: "PUT", body: JSON.stringify(body) });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-4 py-3 flex items-center gap-3">
        <Link to="/" className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="font-semibold">求职意向</h1>
      </header>
      <div className="max-w-lg mx-auto p-6 space-y-5">
        <TagAutocomplete
          label="目标城市"
          value={cities}
          onChange={setCities}
          options={cityOptions}
          placeholder="例如：上海、北京"
          maxItems={10}
        />
        <TagAutocomplete
          label="目标岗位"
          hint="如数据分析、后端开发、产品经理"
          value={roles}
          onChange={setRoles}
          options={roleOptions}
          placeholder="输入岗位方向"
          maxItems={12}
        />
        <TagAutocomplete
          label="意向行业"
          value={industries}
          onChange={setIndustries}
          options={industryOptions}
          placeholder="例如：互联网、金融"
          maxItems={8}
        />
        <div>
          <label className="text-sm text-gray-600">求职类型</label>
          <select
            className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-100"
            value={jobType}
            onChange={(e) => setJobType(e.target.value)}
          >
            {JOB_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm text-gray-600">个人补充</label>
          <textarea
            className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2 h-28 focus:outline-none focus:ring-2 focus:ring-brand-100"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="可补充期望团队、技术栈偏好、到岗时间等"
          />
        </div>
        <button
          onClick={save}
          className="w-full py-2.5 rounded-xl bg-brand-600 text-white font-medium hover:bg-brand-700"
        >
          {saved ? "已保存" : "保存"}
        </button>
      </div>
    </div>
  );
}
