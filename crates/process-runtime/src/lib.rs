#[cfg(windows)]
pub struct ProcessGuard(windows_sys::Win32::Foundation::HANDLE);

#[cfg(windows)]
// The job handle is exclusively owned; Windows permits closing it on another thread.
unsafe impl Send for ProcessGuard {}

#[cfg(windows)]
impl ProcessGuard {
    pub fn attach(child: &tokio::process::Child) -> std::io::Result<Self> {
        use std::{
            mem::{size_of, zeroed},
            ptr::null,
        };
        use windows_sys::Win32::{
            Foundation::CloseHandle,
            System::JobObjects::{
                AssignProcessToJobObject, CreateJobObjectW, JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
                JOBOBJECT_EXTENDED_LIMIT_INFORMATION, JobObjectExtendedLimitInformation,
                SetInformationJobObject,
            },
        };
        let process = child
            .raw_handle()
            .ok_or_else(std::io::Error::last_os_error)?;
        unsafe {
            let job = CreateJobObjectW(null(), null());
            if job.is_null() {
                return Err(std::io::Error::last_os_error());
            }
            let mut limits: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = zeroed();
            limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
            if SetInformationJobObject(
                job,
                JobObjectExtendedLimitInformation,
                &limits as *const _ as *const _,
                size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
            ) == 0
                || AssignProcessToJobObject(job, process as _) == 0
            {
                let error = std::io::Error::last_os_error();
                CloseHandle(job);
                return Err(error);
            }
            Ok(Self(job))
        }
    }
}

#[cfg(windows)]
impl Drop for ProcessGuard {
    fn drop(&mut self) {
        unsafe {
            windows_sys::Win32::Foundation::CloseHandle(self.0);
        }
    }
}

#[cfg(unix)]
pub struct ProcessGuard(u32);

#[cfg(unix)]
impl ProcessGuard {
    pub fn attach(child: &tokio::process::Child) -> std::io::Result<Self> {
        child
            .id()
            .map(Self)
            .ok_or_else(|| std::io::Error::other("process_missing"))
    }
}

#[cfg(unix)]
impl Drop for ProcessGuard {
    fn drop(&mut self) {
        unsafe {
            libc::kill(-(self.0 as i32), libc::SIGKILL);
        }
    }
}
