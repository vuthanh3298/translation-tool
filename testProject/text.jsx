import { useTranslation } from "react-i18next";
export default function Test() {
  const { t } = useTranslation();
  function abc() {
    return <div>{t("xyz")}</div>;
  }
  function handelClick() {
    console.log("abnc");
  }
  const name = "name";
  return (
    <div>
      <div>{t("text")}</div>
      <div>{t("text")}</div>
      <div>{t("text")}</div>
      <div>{t("multi rows text")}</div>
      <div>{t(variable)}</div>
      <SpecialTag value="text" propNeedToTranslate={t("text")}></SpecialTag>
      <SpecialTag value={"text"} propNeedToTranslate={t("text")}></SpecialTag>
      <SpecialTag
        value={varibale}
        propNeedToTranslate={t(varibale)}
      ></SpecialTag>
      <SpecialTag
        value={member.expression.varibale}
        propNeedToTranslate={t(member.expression.varibale)}
      ></SpecialTag>

      {t("abc")}
      <div>{t(name)}</div>
      <div>{t("abc")}</div>
      <div onClick={handelClick}>{t("123")}</div>
      <FieldInfo value={t("456")}>{t("789")}</FieldInfo>
      <FieldInfo value={t("jkl")}>
        {t(
          "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua"
        )}
      </FieldInfo>
      <FieldInfo value={t("jkl")}>{t("ljdkf")}</FieldInfo>
    </div>
  );
}
