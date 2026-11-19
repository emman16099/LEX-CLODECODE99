import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import {
  useGetEmployee,
  useCreateEmployee,
  useUpdateEmployee,
  useSetEmployeeCredentials,
  getListEmployeesQueryKey,
  getGetEmployeeQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save, KeyRound } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FormValues {
  employeeCode: string;
  firstName: string;
  lastName: string;
  mobileNumber: string;
  address: string;
  hireDate: string;
  employmentStatus: "active" | "inactive" | "terminated";
  dailyRate: string;
  mondayRate: string;
  tuesdayRate: string;
  wednesdayRate: string;
  thursdayRate: string;
  fridayRate: string;
  saturdayRate: string;
  sundayRate: string;
  overtimeRate: string;
  sssNumber: string;
  philhealthNumber: string;
  pagibigNumber: string;
}

interface CredentialsForm {
  username: string;
  password: string;
  confirmPassword: string;
}

interface Props {
  employeeId?: string;
}

export default function AdminEmployeeForm({ employeeId }: Props) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEdit = !!employeeId;
  const [showCredentials, setShowCredentials] = useState(false);
  const [savedCredentials, setSavedCredentials] = useState<{ username: string; password: string } | null>(null);
  const [credError, setCredError] = useState("");

  const {
    register: regCred,
    handleSubmit: handleCredSubmit,
    reset: resetCred,
    watch: watchCred,
    formState: { errors: credErrors, isSubmitting: credSubmitting },
  } = useForm<CredentialsForm>();

  const credentialsMutation = useSetEmployeeCredentials({
    mutation: {
      onSuccess: (data) => {
        toast({ title: `Login credentials set — username: ${data.username}` });
        setShowCredentials(false);
        resetCred();
      },
      onError: () => {
        setCredError("Failed to set credentials. Username may already be taken.");
      },
    },
  });

  const onCredentialsSubmit = (values: CredentialsForm) => {
    setCredError("");
    credentialsMutation.mutate({
      id: employeeId!,
      data: { username: values.username, password: values.password },
    }, {
      onSuccess: (data) => {
        setSavedCredentials({ username: data.username, password: values.password });
      },
      onError: () => {
        setSavedCredentials(null);
      },
    });
  };

  const { data: employee, isLoading: loadingEmployee } = useGetEmployee(employeeId!, {
    query: { queryKey: getGetEmployeeQueryKey(employeeId!), enabled: isEdit },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      employmentStatus: "active",
      dailyRate: "500",
      mondayRate: "",
      tuesdayRate: "",
      wednesdayRate: "",
      thursdayRate: "",
      fridayRate: "",
      saturdayRate: "",
      sundayRate: "",
      overtimeRate: "",
    },
  });

  useEffect(() => {
    if (employee) {
      reset({
        employeeCode: employee.employeeCode,
        firstName: employee.firstName,
        lastName: employee.lastName,
        mobileNumber: employee.mobileNumber,
        address: employee.address,
        hireDate: employee.hireDate,
        employmentStatus: employee.employmentStatus,
        dailyRate: employee.dailyRate,
        mondayRate: employee.mondayRate ?? "",
        tuesdayRate: employee.tuesdayRate ?? "",
        wednesdayRate: employee.wednesdayRate ?? "",
        thursdayRate: employee.thursdayRate ?? "",
        fridayRate: employee.fridayRate ?? "",
        saturdayRate: employee.saturdayRate ?? "",
        sundayRate: employee.sundayRate ?? "",
        overtimeRate: employee.overtimeRate ?? "",
        sssNumber: employee.sssNumber,
        philhealthNumber: employee.philhealthNumber,
        pagibigNumber: employee.pagibigNumber,
      });
    }
  }, [employee, reset]);

  const createMutation = useCreateEmployee({
    mutation: {
      onSuccess: (createdEmployee) => {
        queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
        toast({
          title: "Employee created successfully",
          description: `${createdEmployee.firstName} ${createdEmployee.lastName} was saved. You can now set their login username and PIN.`,
        });
        navigate(`/admin/employees/${createdEmployee.id}`);
      },
      onError: (error: unknown) => {
        const requestError = error as { data?: { error?: string }; message?: string };
        toast({
          title: "Failed to create employee",
          description: requestError.data?.error ?? requestError.message ?? "Please check the employee details and try again.",
          variant: "destructive",
        });
      },
    },
  });

  const updateMutation = useUpdateEmployee({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetEmployeeQueryKey(employeeId!) });
        toast({ title: "Employee updated" });
        navigate("/admin/employees");
      },
      onError: (error: unknown) => {
        const requestError = error as { data?: { error?: string }; message?: string };
        toast({
          title: "Failed to update employee",
          description: requestError.data?.error ?? requestError.message ?? "Please check the employee details and try again.",
          variant: "destructive",
        });
      },
    },
  });

  const onSubmit = (values: FormValues) => {
    const optionalRates = {
      mondayRate: values.mondayRate.trim() || null,
      tuesdayRate: values.tuesdayRate.trim() || null,
      wednesdayRate: values.wednesdayRate.trim() || null,
      thursdayRate: values.thursdayRate.trim() || null,
      fridayRate: values.fridayRate.trim() || null,
      saturdayRate: values.saturdayRate.trim() || null,
      sundayRate: values.sundayRate.trim() || null,
    };
    const employeeData = {
      ...values,
      ...optionalRates,
      overtimeRate: values.overtimeRate.trim() || null,
    };
    if (isEdit) {
      updateMutation.mutate({ id: employeeId!, data: employeeData });
    } else {
      createMutation.mutate({ data: employeeData });
    }
  };

  if (isEdit && loadingEmployee) {
    return (
      <div className="page-container max-w-3xl">
        <div className="animate-pulse space-y-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-10 bg-muted rounded" />
          ))}
        </div>
      </div>
    );
  }

  const Field = ({
    label,
    name,
    type = "text",
    required = true,
    placeholder,
  }: {
    label: string;
    name: keyof FormValues;
    type?: string;
    required?: boolean;
    placeholder?: string;
  }) => (
    <div>
      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      <input
        type={type}
        placeholder={placeholder}
        {...register(name, { required: required ? `${label} is required` : false })}
        className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />
      {errors[name] && (
        <p className="text-xs text-destructive mt-1">{errors[name]?.message as string}</p>
      )}
    </div>
  );

  return (
    <div className="page-container max-w-3xl">
      <div className="mb-6">
        <button
          onClick={() => navigate("/admin/employees")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Employees
        </button>
        <h1 className="text-xl font-bold text-foreground">
          {isEdit ? "Edit Employee" : "Add Employee"}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {isEdit ? `Editing ${employee?.firstName} ${employee?.lastName}` : "Create a new employee record"}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Basic Info */}
        <div className="bg-card border border-card-border rounded-lg p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4 pb-3 border-b border-card-border">
            Basic Information
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Employee Code" name="employeeCode" placeholder="EMP-001" />
            <div>
              <Field label="Default Daily Rate (PHP)" name="dailyRate" type="number" placeholder="500.00" />
              <p className="mt-1 text-xs text-muted-foreground">
                Used for any weekday left blank below.
              </p>
            </div>
            <div className="sm:col-span-2 rounded-md border border-card-border bg-muted/20 p-4">
              <h3 className="text-sm font-semibold text-foreground">Daily rates by weekday</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Optional. Set a different rate for each day, such as Monday ₱800 and Tuesday ₱900.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Field label="Monday" name="mondayRate" type="number" required={false} placeholder="Default" />
                <Field label="Tuesday" name="tuesdayRate" type="number" required={false} placeholder="Default" />
                <Field label="Wednesday" name="wednesdayRate" type="number" required={false} placeholder="Default" />
                <Field label="Thursday" name="thursdayRate" type="number" required={false} placeholder="Default" />
                <Field label="Friday" name="fridayRate" type="number" required={false} placeholder="Default" />
                <Field label="Saturday" name="saturdayRate" type="number" required={false} placeholder="Default" />
                <Field label="Sunday" name="sundayRate" type="number" required={false} placeholder="Default" />
              </div>
            </div>
            <div>
              <Field
                label="Overtime Rate (PHP per hour)"
                name="overtimeRate"
                type="number"
                required={false}
                placeholder="e.g. 125.00"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Optional. If blank, payroll uses daily rate ÷ 8 × 1.25.
              </p>
            </div>
            <Field label="First Name" name="firstName" placeholder="Maria" />
            <Field label="Last Name" name="lastName" placeholder="Santos" />
            <Field label="Mobile Number" name="mobileNumber" placeholder="09xx-xxx-xxxx" />
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Employment Status <span className="text-destructive">*</span>
              </label>
              <select
                {...register("employmentStatus", { required: true })}
                className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="terminated">Terminated</option>
              </select>
            </div>
            <Field label="Hire Date" name="hireDate" type="date" />
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Address <span className="text-destructive">*</span>
              </label>
              <textarea
                {...register("address", { required: "Address is required" })}
                rows={2}
                className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
              {errors.address && (
                <p className="text-xs text-destructive mt-1">{errors.address.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Government IDs */}
        <div className="bg-card border border-card-border rounded-lg p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4 pb-3 border-b border-card-border">
            Government IDs
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="SSS Number" name="sssNumber" placeholder="XX-XXXXXXX-X" />
            <Field label="PhilHealth Number" name="philhealthNumber" placeholder="XXXX-XXXXX-X" />
            <Field label="Pag-IBIG Number" name="pagibigNumber" placeholder="XXXX-XXXX-XXXX" />
          </div>
        </div>

        {/* Portal Login Credentials (edit mode only) */}
        {isEdit && (
          <div className="bg-card border border-card-border rounded-lg p-5">
            <div className="flex items-center justify-between mb-1">
              <div>
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-muted-foreground" />
                  Portal Login Credentials
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Set a username and 4-digit PIN so this employee can log in to the portal.
                </p>
              </div>
              {!showCredentials && (
                <button
                  type="button"
                  onClick={() => {
                    setSavedCredentials(null);
                    setShowCredentials(true);
                  }}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  {employee?.portalUsername ? "Change credentials" : "Set credentials"}
                </button>
              )}
            </div>

            {employee?.portalUsername && !showCredentials && (
              <p className="text-xs text-muted-foreground mt-3 bg-muted/40 px-3 py-2 rounded-md">
                Current username: <span className="font-mono font-semibold text-foreground">{employee.portalUsername}</span>
              </p>
            )}

            {showCredentials && (
              <div className="mt-4 space-y-3 border-t border-card-border pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                      Username <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      autoComplete="off"
                      {...regCred("username", { required: "Username is required", minLength: { value: 3, message: "Min 3 characters" } })}
                      className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      placeholder="e.g. mae.reyno"
                    />
                    {credErrors.username && (
                      <p className="text-xs text-destructive mt-1">{credErrors.username.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                      4-Digit PIN <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]{4}"
                      maxLength={4}
                      autoComplete="new-password"
                      {...regCred("password", {
                        required: "PIN is required",
                        pattern: { value: /^\d{4}$/, message: "PIN must be exactly 4 digits" },
                      })}
                      className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      placeholder="Enter 4 digits"
                    />
                    {credErrors.password && (
                      <p className="text-xs text-destructive mt-1">{credErrors.password.message}</p>
                    )}
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                      Confirm PIN <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]{4}"
                      maxLength={4}
                      autoComplete="new-password"
                      {...regCred("confirmPassword", {
                        required: "Please confirm the PIN",
                        validate: (v) => v === watchCred("password") || "PINs do not match",
                      })}
                      className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      placeholder="Repeat 4-digit PIN"
                    />
                    {credErrors.confirmPassword && (
                      <p className="text-xs text-destructive mt-1">{credErrors.confirmPassword.message}</p>
                    )}
                  </div>
                </div>
                {credError && (
                  <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-md">{credError}</p>
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={credSubmitting || credentialsMutation.isPending}
                    onClick={() => handleCredSubmit(onCredentialsSubmit)()}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    Save Credentials
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowCredentials(false); resetCred(); setCredError(""); }}
                    className="px-4 py-2 text-sm border border-input rounded-md text-foreground hover:bg-muted/40 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
             {savedCredentials && !showCredentials && (
               <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
                 <div className="font-semibold">Credentials updated successfully</div>
                 <p className="mt-1 text-xs text-emerald-800">
                    This is the new PIN you just entered. It is shown only until you leave or refresh this page.
                 </p>
                 <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                   <div>
                     <span className="text-emerald-700">Username</span>
                     <div className="mt-1 rounded border border-emerald-200 bg-white/70 px-2 py-1.5 font-mono">{savedCredentials.username}</div>
                   </div>
                   <div>
                      <span className="text-emerald-700">PIN</span>
                     <div className="mt-1 rounded border border-emerald-200 bg-white/70 px-2 py-1.5 font-mono break-all">{savedCredentials.password}</div>
                   </div>
                 </div>
                 <button
                   type="button"
                   onClick={() => setSavedCredentials(null)}
                   className="mt-3 text-xs font-medium text-emerald-800 hover:underline"
                 >
                    Hide PIN
                 </button>
               </div>
             )}
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate("/admin/employees")}
            className="px-4 py-2 text-sm border border-input rounded-md text-foreground hover:bg-muted/40 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || createMutation.isPending || updateMutation.isPending}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {isEdit ? "Save Changes" : "Create Employee"}
          </button>
        </div>
      </form>
    </div>
  );
}
