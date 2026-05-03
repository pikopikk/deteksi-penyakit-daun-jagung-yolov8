const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
        if (entry.isIntersecting) {
            entry.target.classList.add('el-show');
        } else {
            entry.target.classList.remove('el-show');
        }
    });
}, {
    threshold: 0.2
});

// HANYA ambil elemen yang memang mau dianimasikan
const elements = document.querySelectorAll('.el-hidden');
elements.forEach((el) => observer.observe(el));