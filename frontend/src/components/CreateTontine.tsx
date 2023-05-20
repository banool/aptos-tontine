import {
  Box,
  Button,
  Checkbox,
  CloseButton,
  Flex,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  HStack,
  Heading,
  IconButton,
  Input,
  NumberInput,
  NumberInputField,
  Radio,
  RadioGroup,
  Spacer,
  Spinner,
  Stack,
  Text,
  Textarea,
  Tooltip,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { AddIcon, MinusIcon } from "@chakra-ui/icons";
import { TontineMembership } from "../api/hooks/useGetTontineMembership";
import { useGetAccountResource } from "../api/hooks/useGetAccountResource";
import { getModuleId, useGlobalState } from "../GlobalState";
import { useState } from "react";
import {
  FALLBACK_POLICY_RETURN_TO_MEMBERS,
  FALLBACK_POLICY_SEND_TO_GIVING_APT,
} from "../constants";
import {
  Field,
  Form,
  Formik,
  FieldArray,
  useFormik,
  FormikProvider,
  FormikHelpers,
} from "formik";
import { useGetAnsNames } from "../api/hooks/useGetAnsName";
import { useGetAnsAddresses } from "../api/hooks/useGetAnsAddress";
import {
  aptToOcta,
  getDurationPretty,
  isValidAccountAddress,
  validateAptString,
} from "../utils";
import { create } from "../api/transactions";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useQueryClient } from "react-query";

interface MyFormValues {
  description: string;
  invitees: string[];
  requiredContribution: number;
  checkInFrequency: number;
  claimWindow: number;
  fallbackPolicy: string;
}

export function CreateTontine({}: {}) {
  const [state, _] = useGlobalState();
  const moduleId = getModuleId(state);
  const { signAndSubmitTransaction } = useWallet();
  const toast = useToast();
  const queryClient = useQueryClient();

  const handleSubmit = async (
    values: MyFormValues,
    actions: FormikHelpers<MyFormValues>,
  ) => {
    var invitees: string[] = [];
    values.invitees.forEach((invitee) => {
      if (isValidAccountAddress(invitee)) {
        invitees.push(invitee);
      } else {
        // Lookup the invitee's address if it is an ANS name.
        const ansAddressLookup = ansAddressLookups?.find(
          (ans) => ans.name === invitee,
        );
        if (ansAddressLookup?.address !== undefined) {
          invitees.push(ansAddressLookup.address);
        } else {
          throw "Invalid invitee, validation should have caught this";
        }
      }
    });
    const requiredContributionInOcta = aptToOcta(values.requiredContribution);
    try {
      await create(
        signAndSubmitTransaction,
        moduleId,
        state.network_value,
        values.description,
        invitees,
        values.checkInFrequency,
        values.claimWindow,
        requiredContributionInOcta,
        parseInt(values.fallbackPolicy),
      );
      toast({
        title: "Tontine created",
        description: "Tontine created successfully",
        status: "success",
        duration: 5000,
        isClosable: true,
      });
      actions.resetForm();
      queryClient.invalidateQueries({ queryKey: "tontineMembership" });
    } catch (e) {
      toast({
        title: "Failed to tontine",
        description: `Failed to create tontine: ${e}`,
        status: "error",
        duration: 7000,
        isClosable: true,
      });
    } finally {
      actions.setSubmitting(false);
    }
  };

  // Form level validation. This is run in addition to all the field level validation.
  const validateValues = (values: MyFormValues) => {
    var errors: any = {};
    if (values.invitees.length === 0) {
      errors.invitees = "Must invite at least one person";
    } else {
      values.invitees.forEach((invitee, index) => {
        var inviteesArrayErrors = [];
        if (invitee === "") {
          inviteesArrayErrors[index] = "Cannot be blank";
        }
        if (!isValidAccountAddress(invitee)) {
          // Lookup the invitee's address if it is an ANS name.
          const ansNameLookup = ansNameLookups?.find(
            (ans) => ans.address === invitee,
          );
          if (ansNameLookup?.name === undefined) {
            inviteesArrayErrors[index] = "Not a valid address or ANS name";
          }
        }
        if (inviteesArrayErrors.length > 0) {
          errors.invitees = inviteesArrayErrors;
        }
      });
    }
    return errors;
  };

  const formik = useFormik<MyFormValues>({
    initialValues: {
      description: "",
      invitees: [""],
      requiredContribution: 10,
      checkInFrequency: 60 * 60,
      claimWindow: 60 * 60 * 2,
      fallbackPolicy: FALLBACK_POLICY_RETURN_TO_MEMBERS.toString(),
    },
    onSubmit: handleSubmit,
    validate: validateValues,
  });

  const validateDescription = (value: string) => {
    let error;
    if (!value) {
      error = "Cannot be blank";
    } else if (value.length > 64) {
      error = "Must be 64 characters or less";
    }
    return error;
  };

  const validateRequiredContribution = (value: string) => {
    let error;
    if (value === "") {
      error = "Cannot be blank";
    } else {
      const inputAsApt = validateAptString(value);
      if (inputAsApt === null) {
        error = "Invalid value";
      } else if (inputAsApt <= 0) {
        error = "Must be greater than 0";
      }
    }
    return error;
  };

  const validateCheckInFrequency = (value: string) => {
    let error;
    if (value === "") {
      return "Cannot be blank";
    } else {
      const num = parseInt(value);
      if (Number.isNaN(num)) {
        error = "Invalid value";
      } else if (num <= 0) {
        error = "Must be greater than 0";
      }
    }
    return error;
  };

  const validateClaimWindow = (value: string) => {
    let error;
    if (value === "") {
      return "Cannot be blank";
    } else {
      const num = parseInt(value);
      if (Number.isNaN(num)) {
        error = "Invalid value";
      } else if (num <= 0) {
        error = "Must be greater than 0";
      }
    }
    return error;
  };

  const entriesToLookup = formik.values.invitees.filter(
    (invitee) => invitee !== "",
  );

  const { data: ansNameLookups } = useGetAnsNames(() => entriesToLookup, {
    enabled: entriesToLookup.length > 0,
  });
  const { data: ansAddressLookups } = useGetAnsAddresses(
    () => entriesToLookup,
    { enabled: entriesToLookup.length > 0 },
  );

  return (
    <Box p={7}>
      <FormikProvider value={formik}>
        <Form>
          <Field name="description" validate={validateDescription}>
            {({ field, form }: { field: any; form: any }) => {
              return (
                <FormControl
                  isInvalid={
                    form.errors.description && form.touched.description
                  }
                >
                  <FormLabel>Description</FormLabel>
                  <Input w="40%" {...field} />
                  <FormErrorMessage>{form.errors.description}</FormErrorMessage>
                </FormControl>
              );
            }}
          </Field>
          <FieldArray
            name="invitees"
            render={(arrayHelpers) => {
              return (
                <Box paddingTop={5}>
                  <FormControl
                    isInvalid={
                      formik.touched.invitees &&
                      !!formik.errors.invitees &&
                      (typeof formik.errors.invitees === "string" ||
                        formik.errors.invitees.some((error) => error))
                    }
                  >
                    <FormLabel>
                      {"Invitees "}

                      <sup>
                        <Tooltip label="You may enter either account addresses or ANS names.">
                          ⓘ
                        </Tooltip>
                      </sup>
                    </FormLabel>
                    {formik.values.invitees.map((invitee, index) => {
                      var helper;
                      const ansNameLookup = ansNameLookups?.find(
                        (ans) => ans.address === invitee,
                      );
                      const ansAddressLookup = ansAddressLookups?.find(
                        (ans) => ans.name === invitee,
                      );
                      if (ansNameLookup?.name) {
                        helper = (
                          <Text p={2}>{`${ansNameLookup.name}.apt`}</Text>
                        );
                      } else if (ansAddressLookup?.address) {
                        helper = <Text p={2}>{ansAddressLookup.address}</Text>;
                      }
                      return (
                        <Box paddingBottom={4} key={index}>
                          <HStack key={index}>
                            <Field name={`invitees.${index}`}>
                              {({ field }: { field: any }) => (
                                <Input
                                  w="75%"
                                  {...field}
                                  id={`invitees.${index}`}
                                />
                              )}
                            </Field>
                            <IconButton
                              aria-label="Remove Invitee"
                              icon={<MinusIcon />}
                              onClick={() => arrayHelpers.remove(index)}
                              isDisabled={formik.values.invitees.length === 1}
                            />
                            <IconButton
                              aria-label="Add Invitee"
                              icon={<AddIcon />}
                              onClick={() => arrayHelpers.push("")}
                            />
                          </HStack>
                          {helper}
                          <FormErrorMessage>
                            {formik.errors.invitees?.[index]}
                          </FormErrorMessage>
                        </Box>
                      );
                    })}
                  </FormControl>
                </Box>
              );
            }}
          />
          <Field
            name="requiredContribution"
            validate={validateRequiredContribution}
          >
            {({ field, form }: { field: any; form: any }) => {
              return (
                <FormControl
                  isInvalid={
                    form.errors.requiredContribution &&
                    form.touched.requiredContribution
                  }
                >
                  <FormLabel paddingTop={5}>
                    Required contribution (APT)
                  </FormLabel>
                  <Input w="30%" {...field} />
                  <FormErrorMessage>
                    {form.errors.requiredContribution}
                  </FormErrorMessage>
                </FormControl>
              );
            }}
          </Field>
          <Field name="checkInFrequency" validate={validateCheckInFrequency}>
            {({ field, form }: { field: any; form: any }) => {
              const helper = field.value ? (
                <FormHelperText>
                  {getDurationPretty(field.value)}
                </FormHelperText>
              ) : null;
              return (
                <FormControl
                  isInvalid={
                    form.errors.checkInFrequency &&
                    form.touched.checkInFrequency
                  }
                >
                  <FormLabel paddingTop={5}>
                    Check in frequency (secs)
                  </FormLabel>
                  <Input w="30%" {...field} />
                  <FormErrorMessage>
                    {form.errors.checkInFrequency}
                  </FormErrorMessage>
                  {helper}
                </FormControl>
              );
            }}
          </Field>
          <Field name="claimWindow" validate={validateClaimWindow}>
            {({ field, form }: { field: any; form: any }) => {
              const helper = field.value ? (
                <FormHelperText>
                  {getDurationPretty(field.value)}
                </FormHelperText>
              ) : null;
              return (
                <FormControl
                  isInvalid={
                    form.errors.claimWindow && form.touched.claimWindow
                  }
                >
                  <FormLabel paddingTop={5}>Claim window (secs)</FormLabel>
                  <Input w="30%" {...field} />
                  <FormErrorMessage>{form.errors.claimWindow}</FormErrorMessage>
                  {helper}
                </FormControl>
              );
            }}
          </Field>
          <Field name="fallbackPolicy">
            {({ field, form }: { field: any; form: any }) => (
              <FormControl
                isInvalid={
                  form.errors.fallbackPolicy && form.touched.fallbackPolicy
                }
              >
                <FormLabel paddingTop={5}>Fallback Policy</FormLabel>
                <RadioGroup
                  id="fallbackPolicy"
                  {...field}
                  value={field.value || ""}
                  onChange={(val) => {
                    form.setFieldValue(field.name, val);
                  }}
                >
                  <Stack direction="row">
                    <Radio value={FALLBACK_POLICY_RETURN_TO_MEMBERS.toString()}>
                      Return to members
                    </Radio>
                    <Radio
                      value={FALLBACK_POLICY_SEND_TO_GIVING_APT.toString()}
                    >
                      Send to giving.apt
                    </Radio>
                  </Stack>
                </RadioGroup>
                <FormErrorMessage>
                  {form.errors.fallbackPolicy}
                </FormErrorMessage>
              </FormControl>
            )}
          </Field>
          <Box paddingTop={5}>
            <Button type="submit" isLoading={formik.isSubmitting}>
              {formik.isSubmitting ? (
                <Spinner size="xs" />
              ) : (
                <Text>Submit</Text>
              )}
            </Button>
          </Box>
        </Form>
      </FormikProvider>
    </Box>
  );
}
